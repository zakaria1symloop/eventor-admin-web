"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { refreshSession } from "./client";
import { SOCKET_URL, type AdminMessage } from "./messaging";
import type { AdminNotification } from "./notifications";
import { tokenStore } from "./token";

/**
 * One shared Socket.IO connection to the `/admin` namespace (MSG-01 live updates).
 * Auth sends the in-memory access token on every (re)connect; an expired token triggers one refresh.
 */
let socket: Socket | null = null;
let users = 0;

function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/admin`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: false,
      auth: (cb) => cb({ token: tokenStore.get() ?? "" }),
    });
    socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code ?? err.message;
      if (code === "AUTH_TOKEN_EXPIRED" || code === "AUTH_TOKEN_MISSING") {
        void refreshSession().then((r) => {
          if (r === "ok") socket?.connect();
        });
      }
    });
  }
  return socket;
}

export interface AdminSocketHandlers {
  onMessageNew?: (message: AdminMessage) => void;
  onMessageUpdated?: (message: AdminMessage) => void;
  onConversationUpdated?: (event: { conversationId: string; reason?: string }) => void;
  /** Module 9: a dispute was opened (row payload). */
  onDisputeNew?: (event: { id: string; reference?: string }) => void;
  /** Module 10: a request was submitted or resubmitted. */
  onAcademicRequest?: (event: { id: string; reference?: string; status?: string }) => void;
  /** Module 13: a notification for the signed-in admin (SHL-02). */
  onNotificationNew?: (notification: AdminNotification) => void;
}

/** Subscribes to live events while mounted; joins the conversation room when `conversationId` is set. */
export function useAdminSocket(handlers: AdminSocketHandlers, conversationId?: string | null) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "test") return;
    const s = getSocket();
    users += 1;
    if (!s.connected) s.connect();
    const onNew = (m: AdminMessage) => ref.current.onMessageNew?.(m);
    const onUpdated = (m: AdminMessage) => ref.current.onMessageUpdated?.(m);
    const onConv = (e: { conversationId: string; reason?: string }) => ref.current.onConversationUpdated?.(e);
    s.on("message:new", onNew);
    s.on("message:updated", onUpdated);
    s.on("conversation:updated", onConv);
    const onDispute = (e: { id: string; reference?: string }) => ref.current.onDisputeNew?.(e);
    const onAcademic = (e: { id: string; reference?: string; status?: string }) =>
      ref.current.onAcademicRequest?.(e);
    s.on("dispute:new", onDispute);
    s.on("academic_request:new", onAcademic);
    s.on("academic_request:updated", onAcademic);
    const onNotification = (n: AdminNotification) => ref.current.onNotificationNew?.(n);
    s.on("notification:new", onNotification);
    return () => {
      s.off("notification:new", onNotification);
      s.off("message:new", onNew);
      s.off("message:updated", onUpdated);
      s.off("conversation:updated", onConv);
      s.off("dispute:new", onDispute);
      s.off("academic_request:new", onAcademic);
      s.off("academic_request:updated", onAcademic);
      users -= 1;
      if (users === 0) s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!conversationId || typeof window === "undefined" || process.env.NODE_ENV === "test") return;
    const s = getSocket();
    const join = () => s.emit("conversation:join", { conversationId });
    if (s.connected) join();
    s.on("connect", join);
    return () => {
      s.off("connect", join);
      if (s.connected) s.emit("conversation:leave", { conversationId });
    };
  }, [conversationId]);
}
