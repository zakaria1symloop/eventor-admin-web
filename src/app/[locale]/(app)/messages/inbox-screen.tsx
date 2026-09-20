"use client";

import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  Ban,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  Scale,
  Unlock,
  XCircle,
} from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DebouncedSearch } from "@/components/data-list/filter-bar";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { useAdminSocket } from "@/lib/api/admin-socket";
import { ApiError } from "@/lib/api/errors";
import {
  conversationKeys,
  conversationTitle,
  getConversation,
  INBOX_FILTERS,
  inboxQuery,
  listConversations,
  markRead,
  reopenConversation,
  type ConversationDetail,
  type ConversationRow,
  type InboxFilter,
  type MessagesPage,
} from "@/lib/api/messaging";
import { dismissMessageReports, reportKeys } from "@/lib/api/reviews";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatMoney, formatNumber, initials, intlLocale } from "@/lib/utils/format";
import { BlockUserDialog, toastBlocked, type UserTarget } from "../users/user-dialogs";
import { ConvertReportDialog } from "../reviews/review-dialogs";
import { Thread, upsertMessage } from "./inbox-thread";
import { CloseConversationDialog, NewMessageDialog } from "./message-dialogs";

function rowTime(iso: string | null, locale: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (d.toDateString() === now.toDateString())
    return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(d);
  if (days < 7) return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(d);
  return formatDate(d, locale);
}

export function InboxScreen({ conversationId }: { conversationId?: string }) {
  const t = useTranslations("inbox");
  const tp = useTranslations("pages.messages");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [url, setUrl] = useQueryStates(
    {
      filter: parseAsStringLiteral(INBOX_FILTERS).withDefault("all"),
      q: parseAsString.withDefault(""),
      user: parseAsString,
      booking: parseAsString,
      new: parseAsString,
      to: parseAsString,
    },
    { history: "replace" },
  );

  const listQuery = {
    ...inboxQuery(url.filter as InboxFilter, {
      q: url.q,
      userId: url.user ?? undefined,
      bookingId: url.booking ?? undefined,
    }),
    limit: 50,
  };
  const list = useQuery({
    queryKey: conversationKeys.list(listQuery),
    queryFn: () => listConversations(listQuery),
    placeholderData: (prev) => prev,
  });
  const detail = useQuery({
    queryKey: conversationKeys.detail(conversationId ?? "none"),
    queryFn: () => getConversation(conversationId!),
    enabled: !!conversationId,
  });

  // A booking link with a single conversation opens it (row menu "Open conversation").
  const onlyRow = url.booking && list.data?.data.length === 1 ? list.data.data[0] : null;
  useEffect(() => {
    if (!conversationId && onlyRow) router.replace(`/messages/${onlyRow.id}`);
  }, [conversationId, onlyRow, router]);

  // Mark read when a conversation is opened.
  const unread = detail.data?.unreadCount ?? 0;
  useEffect(() => {
    if (!conversationId || unread === 0) return;
    void markRead(conversationId).then(
      () => {
        void queryClient.invalidateQueries({ queryKey: [...conversationKeys.all, "list"] });
        void queryClient.invalidateQueries({ queryKey: conversationKeys.badge() });
      },
      () => undefined,
    );
  }, [conversationId, unread, queryClient]);

  useAdminSocket(
    {
      onMessageNew: (m) => {
        queryClient.setQueryData<InfiniteData<MessagesPage, string | undefined>>(
          conversationKeys.messages(m.conversationId),
          (d) => upsertMessage(d, m, true),
        );
        void queryClient.invalidateQueries({ queryKey: [...conversationKeys.all, "list"] });
        void queryClient.invalidateQueries({ queryKey: conversationKeys.badge() });
        if (m.conversationId === conversationId) void markRead(m.conversationId).catch(() => undefined);
      },
      onMessageUpdated: (m) =>
        queryClient.setQueryData<InfiniteData<MessagesPage, string | undefined>>(
          conversationKeys.messages(m.conversationId),
          (d) => upsertMessage(d, m),
        ),
      onConversationUpdated: (e) => {
        void queryClient.invalidateQueries({ queryKey: [...conversationKeys.all, "list"] });
        void queryClient.invalidateQueries({ queryKey: conversationKeys.detail(e.conversationId) });
        void queryClient.invalidateQueries({ queryKey: conversationKeys.badge() });
      },
    },
    conversationId,
  );

  const counts = list.data?.meta.counts;
  const open = (id: string) => router.push(`/messages/${id}`);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("manage") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        actions={
          <Button icon={<Plus />} onClick={() => void setUrl({ new: "1", to: null })}>
            {t("messageUser")}
          </Button>
        }
      />
      <div className="grid h-[calc(100dvh-230px)] min-h-[560px] overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)_250px]">
        {/* list */}
        <section
          aria-label={t("listLabel")}
          className={cn("flex min-h-0 flex-col border-e border-border", conversationId && "max-lg:hidden")}
        >
          <div className="flex flex-col gap-2.5 border-b border-border p-3.5">
            <DebouncedSearch
              value={url.q}
              placeholder={t("searchPlaceholder")}
              onChange={(q) => void setUrl({ q: q || null })}
            />
            <div
              role="radiogroup"
              aria-label={t("filtersLabel")}
              className="flex gap-1.5 overflow-x-auto pb-0.5"
            >
              {INBOX_FILTERS.map((f) => {
                const on = url.filter === f;
                const n = counts?.[f];
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => void setUrl({ filter: f === "all" ? null : f })}
                    className={cn(
                      "h-7 shrink-0 rounded-pill border px-2.5 text-12 whitespace-nowrap",
                      on
                        ? "border-brand/30 bg-brand-soft font-medium text-brand"
                        : "border-border text-ink hover:bg-canvas",
                    )}
                  >
                    {t(`filters.${f}`)}
                    {f !== "all" && n ? ` · ${formatNumber(n, locale)}` : ""}
                  </button>
                );
              })}
            </div>
            {(url.user || url.booking) && (
              <div className="flex items-center justify-between gap-2 text-12 text-muted">
                {url.user ? t("filteredByUser") : t("filteredByBooking")}
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => void setUrl({ user: null, booking: null })}
                >
                  {t("clearFilter")}
                </button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={list.isFetching || undefined}>
            {list.isPending ? (
              <ul aria-hidden className="flex flex-col">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="flex gap-3 border-b border-border px-3.5 py-3">
                    <span className="size-9 animate-pulse rounded-full bg-gray-soft" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-2/3 animate-pulse rounded bg-gray-soft" />
                      <span className="block h-3 w-1/2 animate-pulse rounded bg-gray-soft" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => void list.refetch()} />
            ) : list.data.data.length === 0 ? (
              <EmptyState
                icon={url.q || url.filter !== "all" ? <Search /> : <MessageCircle />}
                title={url.q || url.filter !== "all" ? t("noResults") : t("empty")}
                className="py-10"
              />
            ) : (
              <ul>
                {list.data.data.map((c) => (
                  <ConversationItem
                    key={c.id}
                    row={c}
                    active={c.id === conversationId}
                    onOpen={() => open(c.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* thread */}
        <section
          aria-label={t("threadLabel")}
          className={cn("flex min-h-0 min-w-0 flex-col", !conversationId && "max-lg:hidden")}
        >
          {!conversationId ? (
            <EmptyState
              icon={<MessageCircle />}
              title={t("pickTitle")}
              description={t("pickDescription")}
              className="m-auto"
            />
          ) : detail.isPending ? (
            <div className="m-auto text-13 text-muted">{t("loading")}</div>
          ) : detail.isError ? (
            detail.error instanceof ApiError && detail.error.status === 404 ? (
              <EmptyState icon={<Search />} title={t("notFound")} className="m-auto" />
            ) : (
              <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
            )
          ) : (
            <ThreadPane conversation={detail.data} />
          )}
        </section>

        {/* details */}
        {conversationId && detail.data && (
          <aside
            aria-label={t("detailsLabel")}
            className="min-h-0 overflow-y-auto border-s border-border max-xl:hidden"
          >
            <DetailsPanel
              conversation={detail.data}
              onWarn={(userId) => void setUrl({ new: "1", to: userId })}
            />
          </aside>
        )}
      </div>

      <NewMessageDialog
        open={url.new === "1"}
        onOpenChange={(o) => !o && void setUrl({ new: null, to: null })}
        toUserIds={url.to ? url.to.split(",") : undefined}
        lockRecipients={!!url.to}
        bookingId={url.to ? url.booking : null}
        onSent={(c) => {
          void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
          router.push(`/messages/${c.id}`);
        }}
      />
    </>
  );
}

function ConversationItem({
  row: c,
  active,
  onOpen,
}: {
  row: ConversationRow;
  active: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const title = conversationTitle(c.participants);
  const preview = [c.booking ? `#${c.booking.reference}` : null, c.lastMessage?.bodyPreview]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 border-b border-border px-3.5 py-3 text-start hover:bg-canvas",
          active && "bg-brand-soft/60",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-12 font-semibold text-blue">
          {initials(title)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-13 text-ink",
                c.unreadCount > 0 ? "font-semibold" : "font-medium",
              )}
            >
              {title}
            </span>
            <span className="shrink-0 text-11 text-faint">{rowTime(c.lastMessageAt, locale)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-12 text-muted">{preview || t("noMessages")}</span>
            {c.reportsOpen > 0 && (
              <Pill tone="red" dot={false}>
                {t("reported")}
              </Pill>
            )}
            {c.status === "closed" && (
              <Lock className="size-3.5 shrink-0 text-faint" aria-label={t("closedLabel")} />
            )}
            {c.unreadCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-brand px-1 text-11 font-medium text-white">
                {c.unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function ThreadPane({ conversation: c }: { conversation: ConversationDetail }) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [dismissingReport, setDismissingReport] = useState(false);
  const [convertingReport, setConvertingReport] = useState(false);
  const people = c.participants.filter((p) => p.role !== "support");
  const report = c.reports[0];
  const setDetail = (d: ConversationDetail) => {
    queryClient.setQueryData(conversationKeys.detail(c.id), d);
    void queryClient.invalidateQueries({ queryKey: [...conversationKeys.all, "list"] });
    void queryClient.invalidateQueries({ queryKey: conversationKeys.badge() });
  };
  const closedForAll = c.status === "closed" && c.closed?.scope === "all";

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <IconButton
          label={t("back")}
          size="sm"
          className="lg:hidden"
          onClick={() => router.push("/messages")}
        >
          <ChevronLeft className="flip-rtl" />
        </IconButton>
        <span className="flex size-9 items-center justify-center rounded-full bg-blue-soft text-12 font-semibold text-blue">
          {initials(conversationTitle(c.participants))}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-1.5 text-15 font-medium">
            {people.map((p, i) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-faint">&amp;</span>}
                <Link href={`/users/${p.id}`} className="text-brand hover:underline">
                  {p.fullName}
                </Link>
              </span>
            ))}
            {people.length === 0 && <span className="text-ink">{t("supportOnly")}</span>}
          </div>
          <div className="truncate text-12 text-muted">
            {[
              t(`kinds.${c.kind}`),
              c.booking ? `#${c.booking.reference}` : null,
              c.booking ? (locale === "ar" ? c.booking.titleAr : c.booking.titleEn) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {c.booking && (
          <Button
            variant="secondary"
            icon={<CalendarDays />}
            onClick={() => router.push(`/bookings/${c.booking!.id}`)}
          >
            {t("openBooking")}
          </Button>
        )}
        {c.status === "closed" ? (
          <IconButton label={t("reopen")} variant="outline" onClick={() => setReopening(true)}>
            <Unlock />
          </IconButton>
        ) : (
          <IconButton label={t("closeConversation")} variant="outline" onClick={() => setClosing(true)}>
            <Ban />
          </IconButton>
        )}
      </header>

      {report && (
        <Banner
          tone="red"
          icon={<Bell />}
          className="rounded-none"
          title={t("reportBanner", {
            name: report.reporter.fullName,
            date: formatDate(report.createdAt, locale),
            reason: t(`reportReasons.${report.reason}`),
          })}
          description={[
            report.note ? `“${report.note}”` : null,
            c.reports.length > 1 ? t("moreReports", { count: c.reports.length - 1 }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          action={
            <span className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDismissingReport(true)}>
                {t("dismissReport")}
              </Button>
              {c.booking && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Scale />}
                  onClick={() => setConvertingReport(true)}
                >
                  {t("convertReport")}
                </Button>
              )}
              {c.status !== "closed" && (
                <Button variant="ghost" size="sm" onClick={() => setClosing(true)}>
                  {t("closeAndResolve")}
                </Button>
              )}
            </span>
          }
        />
      )}
      {c.dispute && (
        <Banner
          tone="amber"
          icon={<TriangleAlert />}
          className="rounded-none"
          title={t("disputeBanner", { reference: c.dispute.reference })}
          action={
            <Link
              href={`/disputes/${c.dispute.id}`}
              className="text-13 font-medium text-amber hover:underline"
            >
              {t("openDispute")}
            </Link>
          }
        />
      )}
      {!c.contactUnmasked && (
        <p className="flex items-center gap-1.5 border-b border-border bg-surface px-5 py-1.5 text-12 text-muted">
          <ShieldCheck className="size-3.5" aria-hidden /> {t("maskingOn")}
        </p>
      )}

      <Thread
        conversation={c}
        closedSlot={
          closedForAll ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-13 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-4" aria-hidden />
                {t("closedBy", {
                  name: c.closed?.closedBy?.fullName ?? "—",
                  date: c.closed?.closedAt ? formatDate(c.closed.closedAt, locale) : "",
                })}
              </span>
              <Button variant="secondary" icon={<Unlock />} onClick={() => setReopening(true)}>
                {t("reopen")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <CloseConversationDialog conversation={c} open={closing} onOpenChange={setClosing} onDone={setDetail} />
      <ConfirmDialog
        open={dismissingReport && !!report}
        onOpenChange={setDismissingReport}
        icon={<XCircle />}
        title={t("dismissReportTitle")}
        description={t("dismissReportDescription", {
          count: c.reports.filter((r) => r.messageId === report?.messageId).length,
        })}
        messageField={{ label: t("dismissReportNote"), required: true }}
        confirmLabel={t("dismissReport")}
        onConfirm={async (v) => {
          if (!report) return;
          await dismissMessageReports(report.messageId, { note: v.message.trim() });
          toast.success(t("reportDismissed"));
          void queryClient.invalidateQueries({ queryKey: conversationKeys.detail(c.id) });
          void queryClient.invalidateQueries({ queryKey: [...conversationKeys.all, "list"] });
          void queryClient.invalidateQueries({ queryKey: reportKeys.all });
        }}
      />
      <ConvertReportDialog
        reportId={convertingReport && report ? report.id : null}
        open={convertingReport}
        onOpenChange={setConvertingReport}
        onDone={() => void queryClient.invalidateQueries({ queryKey: conversationKeys.detail(c.id) })}
      />
      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        icon={<Unlock />}
        title={t("reopenTitle")}
        description={t("reopenDescription")}
        confirmLabel={t("reopen")}
        onConfirm={async () => {
          setDetail(await reopenConversation(c.id));
          toast.success(t("reopened"));
        }}
      />
    </>
  );
}

function DetailsPanel({
  conversation: c,
  onWarn,
}: {
  conversation: ConversationDetail;
  onWarn: (userId: string) => void;
}) {
  const t = useTranslations("inbox.details");
  const tu = useTranslations("users");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const people = c.participants.filter((p) => p.role !== "support");
  const [blocking, setBlocking] = useState<UserTarget | null>(null);
  const muted = new Set(c.closed?.mutedUserIds ?? []);
  const section = "border-b border-border px-4 py-3.5";
  const heading = "mb-2 text-11 font-medium tracking-wide text-muted uppercase";

  return (
    <>
      <div className={section}>
        <div className={heading}>{t("people")}</div>
        <ul className="flex flex-col gap-3">
          {c.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-soft text-11 font-semibold text-blue">
                {initials(p.fullName)}
              </span>
              <span className="min-w-0 leading-tight">
                {p.role === "support" ? (
                  <span className="block truncate text-13 font-medium text-ink">{p.fullName}</span>
                ) : (
                  <Link
                    href={`/users/${p.id}`}
                    className="block truncate text-13 font-medium text-brand hover:underline"
                  >
                    {p.fullName}
                  </Link>
                )}
                <span className="block truncate text-12 text-muted">
                  {[
                    t(`roles.${p.role}`),
                    p.blocked ? t("blocked") : null,
                    !p.canWrite || muted.has(p.id) ? t("readOnly") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {(c.booking || c.dispute) && (
        <div className={section}>
          <div className={heading}>{t("linked")}</div>
          {c.booking && (
            <Link
              href={`/bookings/${c.booking.id}`}
              className="flex items-start gap-2 text-13 font-medium text-brand hover:underline"
            >
              <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                #{c.booking.reference} · <StatusText status={c.booking.status} />
                <span className="block text-12 font-normal text-muted">
                  {formatDate(`${c.booking.eventDate}T12:00:00`, locale)} ·{" "}
                  {formatMoney(c.booking.total, locale)}
                </span>
              </span>
            </Link>
          )}
          {c.booking && (c.booking.titleEn || c.booking.titleAr) && (
            <p className="mt-1.5 flex items-center gap-2 text-13 text-ink-2">
              <Briefcase className="size-4 shrink-0" aria-hidden />
              {locale === "ar" ? c.booking.titleAr || c.booking.titleEn : c.booking.titleEn}
            </p>
          )}
          {c.dispute && (
            <Link
              href={`/disputes/${c.dispute.id}`}
              className="mt-1.5 flex items-center gap-2 text-13 font-medium text-brand hover:underline"
            >
              <TriangleAlert className="size-4 shrink-0" aria-hidden />#{c.dispute.reference}
            </Link>
          )}
        </div>
      )}
      <div className={section}>
        <div className={heading}>{t("moderation")}</div>
        <div className="flex flex-col items-start gap-2">
          {people
            .filter((p) => !p.blocked)
            .map((p) => (
              <Button
                key={`b-${p.id}`}
                variant="secondary"
                icon={<Ban />}
                onClick={() =>
                  setBlocking({ id: p.id, fullName: p.fullName, role: p.userRole, email: p.email })
                }
              >
                {t("block", { name: p.fullName })}
              </Button>
            ))}
          {people.map((p) => (
            <Button key={`w-${p.id}`} variant="secondary" icon={<Bell />} onClick={() => onWarn(p.id)}>
              {t("warn", { name: p.fullName })}
            </Button>
          ))}
        </div>
      </div>
      <BlockUserDialog
        user={blocking}
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        onBlocked={(result) => {
          const target = blocking!;
          void queryClient.invalidateQueries({ queryKey: conversationKeys.detail(c.id) });
          toastBlocked(
            tu,
            target,
            result,
            () => void queryClient.invalidateQueries({ queryKey: conversationKeys.detail(c.id) }),
          );
        }}
      />
    </>
  );
}

function StatusText({ status }: { status: string }) {
  const t = useTranslations("status.booking");
  return <>{t.has(status) ? t(status) : status}</>;
}
