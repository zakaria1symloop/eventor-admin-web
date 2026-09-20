/**
 * Module 13 — admin notifications (SHL-02).
 * `GET /admin/notifications?unread&page&limit`, `GET /admin/notifications/unread-count`, `POST /admin/notifications/read`.
 * Live: socket `notification:new` on `/admin`.
 */
import { api, type DataResponse, type ListResponse, type QueryParams } from "./client";

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
export interface UnreadCount {
  unread: number;
}
export type MarkReadBody = { ids: string[]; all?: never } | { all: true; ids?: never };
export interface MarkReadResult {
  updated: number;
  unread: number;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (q: QueryParams) => [...notificationKeys.all, "list", q] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

export function listNotifications(query: QueryParams): Promise<ListResponse<AdminNotification>> {
  return api.get<ListResponse<AdminNotification>>("/admin/notifications", { query });
}
export async function getUnreadCount(): Promise<number> {
  return (await api.get<DataResponse<UnreadCount>>("/admin/notifications/unread-count")).data.unread;
}
export async function markNotificationsRead(body: MarkReadBody): Promise<MarkReadResult> {
  return (await api.post<DataResponse<MarkReadResult>>("/admin/notifications/read", body)).data;
}

export function notificationHref(n: AdminNotification): string | null {
  const href = n.data?.href;
  return typeof href === "string" ? href : null;
}
