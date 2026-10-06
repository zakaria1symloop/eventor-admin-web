"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { requestKeys } from "@/lib/api/academic-requests";
import { useAdminSocket } from "@/lib/api/admin-socket";
import { disputeKeys } from "@/lib/api/disputes";
import { notificationKeys } from "@/lib/api/notifications";
import { onApiWrite } from "@/lib/api/client";
import { getNavCounts, overviewKeys, type NavCounts } from "@/lib/api/overview";
import { useSession, useSignOut } from "@/lib/auth/use-session";
import type { SidebarBadges } from "./sidebar";
import { AppShell } from "./app-shell";
import { AUTH_ENABLED, AuthGuard } from "./auth-guard";

/** `GET /admin/nav-counts` → sidebar badges (module 13 replaces the per-list count queries). */
export function navBadges(c: NavCounts | undefined): SidebarBadges {
  const badges: SidebarBadges = {};
  if (!c) return badges;
  if (c.verificationsWaiting > 0) badges.verifications = { count: c.verificationsWaiting, tone: "amber" };
  if (c.bookingsNoReply > 0) badges.bookings = { count: c.bookingsNoReply, tone: "red" };
  if (c.disputesOpen > 0) badges.disputes = { count: c.disputesOpen, tone: "red" };
  if (c.academicRequestsPending > 0)
    badges.academicRequests = { count: c.academicRequestsPending, tone: "amber" };
  if (c.reviewsReported > 0) badges.reviews = { count: c.reviewsReported, tone: "red" };
  const inbox = c.messagesReported + c.messagesUnread;
  if (inbox > 0) badges.messages = { count: inbox, tone: c.messagesReported ? "red" : "brand" };
  return badges;
}

function SessionShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const session = useSession({ enabled: AUTH_ENABLED });
  const signOut = useSignOut();
  const account = session.data ? { name: session.data.fullName, role: t("role"), avatarUrl: session.data.avatarUrl } : undefined;
  const ready = !AUTH_ENABLED || !!session.data;
  const counts = useQuery({
    queryKey: overviewKeys.navCounts(),
    queryFn: getNavCounts,
    enabled: ready,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const queryClient = useQueryClient();
  const refreshCounts = () => void queryClient.invalidateQueries({ queryKey: overviewKeys.navCounts() });
  useAdminSocket({
    onDisputeNew: () => {
      void queryClient.invalidateQueries({ queryKey: disputeKeys.all });
      refreshCounts();
    },
    onAcademicRequest: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      refreshCounts();
    },
    onConversationUpdated: refreshCounts,
    onNotificationNew: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      refreshCounts();
    },
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onApiWrite((path) => {
      if (path.startsWith("/admin/notifications") || path.startsWith("/admin/saved-views")) return;
      clearTimeout(timer);
      timer = setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: overviewKeys.navCounts() }),
        800,
      );
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [queryClient]);
  const badges = navBadges(counts.data);
  return (
    <AppShell
      account={account}
      badges={Object.keys(badges).length ? badges : undefined}
      notificationsEnabled={AUTH_ENABLED ? !!session.data : false}
      onSignOut={() => signOut.mutate()}
    >
      {children}
    </AppShell>
  );
}

/** AuthGuard + AppShell fed by the current session (the (app) group layout). */
export function ProtectedShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <SessionShell>{children}</SessionShell>
    </AuthGuard>
  );
}
