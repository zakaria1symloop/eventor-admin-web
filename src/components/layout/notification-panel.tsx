"use client";

import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  Check,
  FileText,
  Flag,
  GraduationCap,
  Layers,
  MessageCircle,
  Star,
  TriangleAlert,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { toneClasses, Pill, type Tone } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getUnreadCount,
  listNotifications,
  markNotificationsRead,
  notificationHref,
  notificationKeys,
  type AdminNotification,
} from "@/lib/api/notifications";
import { dashboardHref } from "@/lib/api/reviews";
import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format";

const LIST_QUERY = { limit: 10 };

export function notificationVisual(type: string): { icon: ReactNode; tone: Tone } {
  if (type === "review.reported") return { icon: <Star />, tone: "red" };
  if (type === "message.reported") return { icon: <MessageCircle />, tone: "red" };
  if (type.startsWith("report")) return { icon: <Flag />, tone: "red" };
  if (type.startsWith("verification")) return { icon: <Check />, tone: "gold" };
  if (type.startsWith("booking")) return { icon: <CalendarDays />, tone: "amber" };
  if (type.startsWith("dispute")) return { icon: <TriangleAlert />, tone: "red" };
  if (type.startsWith("academic_request")) return { icon: <GraduationCap />, tone: "brand" };
  if (type.startsWith("export")) return { icon: <FileText />, tone: "green" };
  if (type.startsWith("pack")) return { icon: <Layers />, tone: "amber" };
  return { icon: <Bell />, tone: "blue" };
}

/** Bell with unread dot (SHL-02 trigger). */
export const NotificationBell = forwardRef<
  HTMLButtonElement,
  { count?: number } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">
>(function NotificationBell({ count = 0, ...rest }, ref) {
  const t = useTranslations("topbar");
  return (
    <IconButton
      ref={ref}
      label={`${t("notifications")} — ${t("notificationsCount", { count })}`}
      variant="outline"
      className="relative rounded-full"
      {...rest}
    >
      <Bell strokeWidth={1.75} />
      {count > 0 && (
        <span
          aria-hidden
          data-testid="notification-dot"
          className="absolute end-1.5 top-1.5 size-2 rounded-full bg-red ring-2 ring-surface"
        />
      )}
    </IconButton>
  );
});

/**
 * SHL-02 — bell + popover: latest notifications with unread dots, mark all as read, click → linked screen.
 * `enabled` turns the API on (signed-in shell); otherwise `count` is shown as-is (stories).
 */
export function NotificationPanel({ enabled = false, count }: { enabled?: boolean; count?: number }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: getUnreadCount,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  const list = useQuery({
    queryKey: notificationKeys.list(LIST_QUERY),
    queryFn: () => listNotifications(LIST_QUERY),
    enabled: enabled && open,
    staleTime: 10_000,
  });
  const unreadCount = enabled ? (unread.data ?? 0) : (count ?? 0);

  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onMutate: (body) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<typeof list.data>(notificationKeys.list(LIST_QUERY), (old) =>
        old
          ? {
              ...old,
              data: old.data.map((n) =>
                !n.readAt && ("all" in body && body.all ? true : body.ids?.includes(n.id))
                  ? { ...n, readAt: now }
                  : n,
              ),
            }
          : old,
      );
    },
    onSuccess: (res) => queryClient.setQueryData(notificationKeys.unread(), res.unread),
    onError: (e) => {
      toast.apiError(e);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  function openItem(n: AdminNotification) {
    if (!n.readAt && enabled) markRead.mutate({ ids: [n.id] });
    const href = dashboardHref(notificationHref(n));
    setOpen(false);
    if (href) router.push(href);
  }

  const items = list.data?.data ?? [];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <NotificationBell count={unreadCount} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label={t("title")}
          className="z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-surface shadow-overlay"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="text-15 font-semibold text-ink">{t("title")}</h2>
            {unreadCount > 0 && (
              <Pill tone="red" dot={false}>
                {t("new", { count: unreadCount })}
              </Pill>
            )}
            <button
              type="button"
              disabled={!enabled || unreadCount === 0 || markRead.isPending}
              onClick={() => markRead.mutate({ all: true })}
              className="ms-auto text-12 font-medium text-brand hover:underline disabled:cursor-default disabled:text-faint disabled:no-underline"
            >
              {t("markAllRead")}
            </button>
          </div>
          <div className="max-h-[min(480px,70dvh)] overflow-y-auto">
            {!enabled ? (
              <p className="px-4 py-8 text-center text-13 text-muted">{t("empty")}</p>
            ) : list.isPending ? (
              <ul aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="flex gap-3 border-b border-border px-4 py-3.5">
                    <span className="size-8 animate-pulse rounded-full bg-gray-soft" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-2/3 animate-pulse rounded-sm bg-gray-soft" />
                      <span className="block h-3 w-full animate-pulse rounded-sm bg-gray-soft" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => void list.refetch()} />
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand [&_svg]:size-5">
                  <Bell />
                </span>
                <p className="text-14 font-medium text-ink">{t("emptyTitle")}</p>
                <p className="mt-1 text-12 text-muted">{t("empty")}</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const v = notificationVisual(n.type);
                  const tone = toneClasses[v.tone];
                  return (
                    <li key={n.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-canvas",
                          !n.readAt && "bg-brand-soft/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
                            tone.soft,
                            tone.text,
                          )}
                        >
                          {v.icon}
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block text-13 font-medium text-ink">{n.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-12 text-ink-2">{n.body}</span>
                          <span className="mt-0.5 block text-11 text-faint">
                            {formatRelative(n.createdAt, locale)}
                          </span>
                        </span>
                        {!n.readAt && (
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-brand">
                            <span className="sr-only">{t("unread")}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link
              href="/settings#notifications"
              onClick={() => setOpen(false)}
              className="text-12 font-medium text-brand hover:underline"
            >
              {t("settings")}
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
