"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  MessageCircle,
  Pencil,
  RotateCcw,
  SearchX,
  X,
  XCircle,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { HistoryList } from "@/components/domain/history-list";
import { MessageBubble } from "@/components/domain/chat";
import { PriceSummary } from "@/components/domain/price-summary";
import { StatusTimeline, type TimelineStep } from "@/components/domain/status-timeline";
import { Banner } from "@/components/feedback/banner";
import { toast } from "@/components/feedback/toast";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { TwoColumn } from "@/components/layout/detail";
import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link, useRouter } from "@/i18n/navigation";
import {
  bookingKeys,
  getBooking,
  isEditable,
  remindProvider,
  type AllowedTransition,
  type BookingDetail,
  type StatusAction,
} from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDateTime, formatMoney, initials, intlLocale } from "@/lib/utils/format";
import { canOpenDispute } from "@/lib/api/bookings";
import { localName } from "../../users/use-user-options";
import { useActionLabel } from "../../activity-log/action-label";
import {
  EventDetailsDrawer,
  InvoiceModal,
  PriceDrawer,
  RescheduleDialog,
  StatusDialog,
} from "../booking-dialogs";
import { statusTarget } from "../bookings-screen";

const actionIcon: Record<StatusAction, ReactNode> = {
  accepted: <Check />,
  declined: <X />,
  cancelled: <XCircle />,
  completed: <CheckCheck />,
  reopen: <RotateCcw />,
};
const actionDot: Record<StatusAction, string> = {
  accepted: "bg-green",
  declined: "bg-red",
  cancelled: "bg-muted",
  completed: "bg-blue",
  reopen: "bg-amber",
};

function hoursSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
}

export function BookingDetailScreen({ id }: { id: string }) {
  const t = useTranslations("bookings");
  const td = useTranslations("bookings.detail");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: bookingKeys.detail(id), queryFn: () => getBooking(id) });
  const [price, setPrice] = useQueryState("price", parseAsString.withOptions({ history: "replace" }));
  const [invoice, setInvoice] = useQueryState("invoice", parseAsString.withOptions({ history: "replace" }));
  const [overlay, setOverlay] = useState<"reschedule" | "details" | null>(null);
  const [statusAction, setStatusAction] = useState<AllowedTransition | null>(null);

  const refresh = (detail?: BookingDetail) => {
    if (detail) queryClient.setQueryData(bookingKeys.detail(id), detail);
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  };

  const remind = useMutation({
    mutationFn: () => remindProvider(query.data!.id),
    onSuccess: () => {
      toast.success(td("remindSent"));
      refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "REMINDER_TOO_SOON") toast.info(td("remindTooSoon"));
      else toast.apiError(e);
    },
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <CardSkeleton className="h-[90px]" />
        <CardSkeleton className="h-[100px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_370px]">
          <CardSkeleton className="h-[420px]" />
          <CardSkeleton className="h-[320px]" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/bookings" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={td("notFoundTitle")}
              description={td("notFoundDescription")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/bookings")}>
                  {td("backToBookings")}
                </Button>,
              ]}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    );
  }

  const b = query.data;
  const editable = isEditable(b.status);

  const statusMenu: ActionMenuItem[][] = [
    b.allowedTransitions.map((tr) => ({
      icon: actionIcon[tr.action],
      label: t(`menu.${tr.action}`),
      danger: tr.action === "cancelled" || tr.action === "declined",
      onSelect: () => setStatusAction(tr),
    })),
  ];
  const moreMenu: ActionMenuItem[][] = [
    [
      ...(b.conversation
        ? [
            {
              icon: <MessageCircle />,
              label: t("menu.openConversation"),
              href: `/messages/${b.conversation.id}`,
            },
          ]
        : []),
      {
        icon: <AlertTriangle />,
        label: t("menu.openDispute"),
        disabled: !canOpenDispute(b),
        href: `/disputes?new=1&booking=${b.id}`,
      },
      {
        icon: <FileText />,
        label: t("menu.viewInvoice"),
        disabled: !b.invoice,
        onSelect: () => void setInvoice("1"),
      },
      {
        icon: <Pencil />,
        label: t("menu.adjustPrice"),
        disabled: !editable,
        onSelect: () => void setPrice("1"),
      },
      {
        icon: <Pencil />,
        label: td("editDetails"),
        disabled: !editable,
        onSelect: () => setOverlay("details"),
      },
      {
        icon: <FileText />,
        label: td("activityLog"),
        href: `/activity-log?objectType=booking&q=${encodeURIComponent(b.reference)}`,
      },
    ],
  ];

  return (
    <>
      <PageHeader
        back
        breadcrumb={[{ label: t("title"), href: "/bookings" }, { label: `#${b.reference}` }]}
        className="mb-3"
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-26 font-semibold text-ink">{td("title", { reference: b.reference })}</h1>
            <StatusBadge domain="booking" status={b.status} />
            {b.noReply && <Pill tone="red">{td("noReplyFor", { hours: hoursSince(b.createdAt) })}</Pill>}
            {b.disputeStatus === "open" && <Pill tone="red">{t("disputeOpen")}</Pill>}
          </div>
          <p className="mt-1 text-14 text-muted">
            {td("requested", {
              date: formatDateTime(b.createdAt, locale),
              source: t(`sources.${b.source}`),
              event: formatDate(`${b.eventDate}T12:00:00`, locale),
            })}
            {b.createdBy && ` · ${td("createdBy", { name: b.createdBy.fullName })}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {b.status === "pending" && (
            <Button
              variant="secondary"
              icon={<Bell />}
              loading={remind.isPending}
              onClick={() => remind.mutate()}
            >
              {td("remind")}
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<CalendarDays />}
            disabled={!editable}
            onClick={() => setOverlay("reschedule")}
          >
            {td("reschedule")}
          </Button>
          <ActionMenu
            groups={statusMenu}
            trigger={
              <Button icon={<ChevronDown />} disabled={b.allowedTransitions.length === 0}>
                {td("changeStatus")}
              </Button>
            }
          />
          <ActionMenu
            groups={moreMenu}
            trigger={
              <Button variant="secondary" className="w-9 px-0" aria-label={td("more")} title={td("more")}>
                <span aria-hidden>⋯</span>
              </Button>
            }
          />
        </div>
      </div>

      {b.dispute && (
        <Banner
          tone="red"
          icon={<AlertTriangle />}
          className="mb-4"
          title={td("disputeBanner", {
            reference: b.dispute.reference,
            status: td(`disputeStatus.${b.dispute.status}`),
          })}
          description={td("disputeOpenedBy", {
            role: t(`status.parties.${b.dispute.openedByRole}`),
            date: formatDate(b.dispute.createdAt, locale),
          })}
          action={
            <Link href={`/disputes/${b.dispute.id}`} className="text-13 font-medium text-red hover:underline">
              {td("openDispute")}
            </Link>
          }
        />
      )}
      {b.pendingReschedule?.status === "pending" && (
        <Banner
          tone="amber"
          icon={<CalendarDays />}
          className="mb-4"
          title={td("pendingDate", { date: formatDate(`${b.pendingReschedule.newDate}T12:00:00`, locale) })}
          description={td("pendingDateBy", { name: b.pendingReschedule.proposedBy.fullName })}
          action={
            <Button variant="secondary" size="sm" onClick={() => setOverlay("reschedule")}>
              {td("manage")}
            </Button>
          }
        />
      )}

      <Card className="mb-4 px-[18px] py-4">
        <BookingTimeline booking={b} />
      </Card>

      <TwoColumn
        main={
          <>
            <WhoAndWhat booking={b} />
            <EventDetailsCard booking={b} onEdit={editable ? () => setOverlay("details") : undefined} />
            <ConversationCard booking={b} />
          </>
        }
        aside={
          <>
            <PriceCard
              booking={b}
              onInvoice={() => void setInvoice("1")}
              onAdjust={editable ? () => void setPrice("1") : undefined}
            />
            {b.allowedTransitions.length > 0 && (
              <Card className="border-brand/30">
                <CardHeader title={td("changeStatus")} />
                <CardBody className="flex flex-col gap-2">
                  {b.allowedTransitions.map((tr) => (
                    <button
                      key={tr.action}
                      type="button"
                      onClick={() => setStatusAction(tr)}
                      className="flex items-start gap-3 rounded-lg border border-border px-3.5 py-2.5 text-start hover:border-brand/40 hover:bg-canvas"
                    >
                      <span
                        aria-hidden
                        className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", actionDot[tr.action])}
                      />
                      <span className="min-w-0">
                        <span className="block text-14 font-medium text-ink">{td(`panel.${tr.action}`)}</span>
                        <span className="block text-12 text-muted">{td(`panelHint.${tr.action}`)}</span>
                      </span>
                    </button>
                  ))}
                  <p className="text-12 text-muted">{td("panelNote")}</p>
                </CardBody>
              </Card>
            )}
            <HistoryCard booking={b} />
          </>
        }
      />

      <StatusDialog
        bookings={statusAction ? [statusTarget(b)] : []}
        action={statusAction?.action ?? null}
        transition={statusAction}
        onOpenChange={(o) => !o && setStatusAction(null)}
        onDone={() => refresh()}
      />
      <RescheduleDialog
        booking={b}
        open={overlay === "reschedule"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={refresh}
      />
      <EventDetailsDrawer
        booking={b}
        open={overlay === "details"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={refresh}
      />
      <PriceDrawer
        booking={b}
        open={price === "1" && editable}
        onOpenChange={(o) => !o && void setPrice(null)}
        onDone={refresh}
      />
      <InvoiceModal
        bookingId={b.id}
        open={invoice === "1"}
        onOpenChange={(o) => !o && void setInvoice(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ timeline */

function BookingTimeline({ booking: b }: { booking: BookingDetail }) {
  const td = useTranslations("bookings.detail.timeline");
  const locale = useLocale();
  const short = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  const decided = b.status !== "pending";
  const failed = b.status === "declined" || b.status === "cancelled";
  const decision = b.timeline.find((e) => e.type === "status" && e.fromStatus === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const eventPassed = b.eventDate < today;
  const steps: TimelineStep[] = [
    { key: "requested", label: td("requested"), sub: short(b.createdAt), state: "done" },
    {
      key: "waiting",
      label: td("waiting"),
      sub:
        b.status === "pending"
          ? [
              td("since", { hours: hoursSince(b.createdAt) }),
              b.reminderSentAt ? td("reminderSent", { date: formatDate(b.reminderSentAt, locale) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : b.respondedAt
            ? td("repliedAt", { date: short(b.respondedAt) })
            : undefined,
      state: b.status === "pending" ? "now" : "done",
    },
    {
      key: "decision",
      label: decided
        ? td(`decided.${b.status === "completed" ? "accepted" : b.status}`)
        : td("acceptedOrDeclined"),
      sub: decision ? short(decision.at) : td("providerDecides"),
      state: !decided ? "next" : failed ? "failed" : "done",
    },
    {
      key: "event",
      label: td("eventDay"),
      sub: formatDate(`${b.eventDate}T12:00:00`, locale),
      state: failed
        ? "next"
        : b.status === "completed" || (b.status === "accepted" && eventPassed)
          ? "done"
          : b.status === "accepted"
            ? "next"
            : "next",
    },
    {
      key: "completed",
      label: td("completed"),
      sub: b.completedAt ? short(b.completedAt) : td("clientReview"),
      state: b.status === "completed" ? "done" : "next",
    },
  ];
  return <StatusTimeline steps={steps} />;
}

/* ------------------------------------------------------------------ cards */

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:underline">
      {children}
      <ChevronRight className="flip-rtl size-4" aria-hidden />
    </Link>
  );
}

function PartyColumn({
  label,
  name,
  sub,
  avatar,
  userId,
  bookingsHref,
  messageHref,
}: {
  label: string;
  name: string;
  sub: string;
  avatar: string | null;
  userId: string;
  bookingsHref: string;
  messageHref: string;
}) {
  const td = useTranslations("bookings.detail");
  return (
    <div className="min-w-0 px-[18px] py-4">
      <div className="mb-2 text-11 font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-13 font-semibold text-brand">
            {initials(name)}
          </span>
        )}
        <span className="min-w-0 leading-tight">
          <Link
            href={`/users/${userId}`}
            className="block truncate text-15 font-medium text-brand hover:underline"
          >
            {name}
          </Link>
          <span className="block truncate text-12 text-muted">{sub}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-13 font-medium text-brand">
        <Link href={`/users/${userId}`} className="hover:underline">
          {td("openProfile")}
        </Link>
        <Link href={bookingsHref} className="hover:underline">
          {td("theirBookings")}
        </Link>
        <Link href={messageHref} className="hover:underline">
          {td("message")}
        </Link>
      </div>
    </div>
  );
}

function WhoAndWhat({ booking: b }: { booking: BookingDetail }) {
  const td = useTranslations("bookings.detail");
  const tsv = useTranslations("services");
  const locale = useLocale();
  const title = locale === "ar" ? b.offer.titleAr || b.offer.titleEn : b.offer.titleEn;
  const reply =
    b.provider.avgReplyMinutes != null
      ? td("repliesIn", {
          time: `${Math.floor(b.provider.avgReplyMinutes / 60)}h ${b.provider.avgReplyMinutes % 60}`,
        })
      : null;
  const msg = (userId: string) => `/messages?new=1&to=${userId}&booking=${b.id}`;
  return (
    <Card>
      <CardHeader title={td("whoAndWhat")} />
      <div className="grid border-b border-border sm:grid-cols-2 sm:divide-x sm:divide-border rtl:sm:divide-x-reverse">
        <PartyColumn
          label={td("client")}
          name={b.client.fullName}
          avatar={b.client.avatarUrl}
          sub={td("clientSub", { count: b.client.bookingsCount })}
          userId={b.client.id}
          bookingsHref={`/bookings?client=${b.client.id}`}
          messageHref={msg(b.client.id)}
        />
        <PartyColumn
          label={td("provider")}
          name={b.provider.fullName}
          avatar={b.provider.avatarUrl}
          sub={[
            b.provider.businessName,
            b.provider.ratingCount ? `${b.provider.rating.toFixed(1)} ★` : null,
            reply,
            !b.provider.acceptingBookings ? td("notAccepting") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          userId={b.provider.id}
          bookingsHref={`/bookings?provider=${b.provider.id}`}
          messageHref={msg(b.provider.id)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 px-[18px] py-3.5">
        {b.offer.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.offer.coverUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            {b.offer.kind === "pack" ? <Layers className="size-4" /> : <Briefcase className="size-4" />}
          </span>
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-15 font-medium text-brand">{title}</span>
          <span className="block truncate text-12 text-muted">
            {[
              b.offer.kind === "pack" ? td("readyPack") : null,
              `${formatMoney(b.offer.basePrice, locale)}${b.offer.priceType ? ` ${tsv(`priceTypesShort.${b.offer.priceType}`)}` : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="text-13 font-medium text-brand">
          <SectionLink href={b.offer.kind === "pack" ? `/packs/${b.offer.id}` : `/services/${b.offer.id}`}>
            {b.offer.kind === "pack" ? td("openPack") : td("openService")}
          </SectionLink>
        </span>
      </div>
      {b.academicRequest && (
        <p className="border-t border-border px-[18px] py-2.5 text-13 text-muted">
          {td("academic")}{" "}
          <Link
            href={`/academic-requests/${b.academicRequest.id}`}
            className="font-medium text-brand hover:underline"
          >
            #{b.academicRequest.reference} · {b.academicRequest.title}
          </Link>
        </p>
      )}
    </Card>
  );
}

function EventDetailsCard({ booking: b, onEdit }: { booking: BookingDetail; onEdit?: () => void }) {
  const td = useTranslations("bookings.detail");
  const tp = useTranslations("packs");
  const locale = useLocale();
  const row = (label: ReactNode, value: ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-2 text-13">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-end text-ink">{value}</dd>
    </div>
  );
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${b.eventDate}T12:00:00`));
  const place = [b.locationText, b.commune ? localName(b.commune, locale) : null, localName(b.wilaya, locale)]
    .filter((v, i, all): v is string => !!v && all.indexOf(v) === i)
    .join(", ");
  return (
    <Card>
      <CardHeader
        title={td("eventDetails")}
        action={
          onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 hover:underline">
              {td("edit")} <Pencil className="size-3.5" aria-hidden />
            </button>
          )
        }
      />
      <dl className="grid gap-x-8 px-[18px] py-2 sm:grid-cols-2">
        <div>
          {row(td("eventType"), tp(`eventTypes.${b.eventType}`))}
          {row(td("date"), date)}
          {row(
            td("time"),
            b.startTime && b.endTime ? (
              <span dir="ltr">{`${b.startTime.slice(0, 5)} – ${b.endTime.slice(0, 5)}`}</span>
            ) : (
              "—"
            ),
          )}
        </div>
        <div>
          {row(td("location"), <span className="font-medium text-brand">{place || "—"}</span>)}
          {row(td("guests"), b.guests ?? "—")}
        </div>
      </dl>
      {b.clientNote && (
        <div className="border-t border-border bg-canvas px-[18px] py-3">
          <div className="text-11 font-medium tracking-wide text-muted uppercase">{td("clientNote")}</div>
          <p className="mt-1 text-13 whitespace-pre-line text-ink">“{b.clientNote}”</p>
        </div>
      )}
      {(b.cancelReason || b.declineReason) && (
        <div className="border-t border-border px-[18px] py-3 text-13 text-ink-2">
          {b.declineReason && td("declineReason", { reason: b.declineReason })}
          {b.cancelReason &&
            td("cancelReason", {
              reason: b.cancelReason,
              by: b.cancelledBy ? td(`by.${b.cancelledBy}`) : "—",
            })}
        </div>
      )}
      {(locale === "ar" ? b.offer.cancellationPolicyAr : b.offer.cancellationPolicyEn) && (
        <div className="border-t border-border px-[18px] py-3">
          <div className="text-11 font-medium tracking-wide text-muted uppercase">
            {td("cancellationPolicy")}
          </div>
          <p className="mt-1 text-13 whitespace-pre-line text-ink-2">
            {locale === "ar" ? b.offer.cancellationPolicyAr : b.offer.cancellationPolicyEn}
          </p>
        </div>
      )}
    </Card>
  );
}

function ConversationCard({ booking: b }: { booking: BookingDetail }) {
  const td = useTranslations("bookings.detail");
  const locale = useLocale();
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  return (
    <Card>
      <CardHeader
        title={td("conversation")}
        action={
          b.conversation && (
            <SectionLink href={`/messages/${b.conversation.id}`}>{td("openChat")}</SectionLink>
          )
        }
      />
      <CardBody className="flex flex-col gap-3">
        {!b.conversation || b.conversation.lastMessages.length === 0 ? (
          <p className="text-13 text-muted">{td("noMessages")}</p>
        ) : (
          b.conversation.lastMessages.map((m) => (
            <MessageBubble
              key={m.id}
              showTime={stamp}
              message={{
                ...m,
                side: "start",
                masked: !!m.bodyMasked,
              }}
            />
          ))
        )}
      </CardBody>
    </Card>
  );
}

function PriceCard({
  booking: b,
  onInvoice,
  onAdjust,
}: {
  booking: BookingDetail;
  onInvoice: () => void;
  onAdjust?: () => void;
}) {
  const td = useTranslations("bookings.detail");
  const locale = useLocale();
  return (
    <Card>
      <CardHeader
        title={td("priceInvoice")}
        titleAddon={undefined}
        actions={<Pill tone="gray">{td("cash")}</Pill>}
      />
      <PriceSummary
        className="py-1"
        lines={b.lines.map((l) => ({
          key: l.id,
          label: l.quantity > 1 ? `${l.label} × ${l.quantity}` : l.label,
          amount: l.amount,
        }))}
        total={b.total}
        feePercent={b.feePercent}
        feeAmount={b.feeAmount}
        providerAmount={b.providerAmount}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-[18px] py-3">
        <Button variant="secondary" icon={<FileText />} onClick={onInvoice} disabled={!b.invoice}>
          {td("viewInvoice")}
        </Button>
        <Button variant="secondary" icon={<Pencil />} onClick={onAdjust} disabled={!onAdjust}>
          {td("adjustPrice")}
        </Button>
      </div>
      <p className="px-[18px] pb-3 text-12 text-muted">
        {b.invoice
          ? td("invoiceIssued", {
              number: b.invoice.number,
              date: formatDate(b.invoice.issuedAt, locale),
            })
          : td("invoiceAfterAccept")}{" "}
        {td("cashNote")}
      </p>
    </Card>
  );
}

function HistoryCard({ booking: b }: { booking: BookingDetail }) {
  const td = useTranslations("bookings.detail");
  const locale = useLocale();
  const actionLabel = useActionLabel();
  return (
    <Card>
      <CardHeader
        title={td("history")}
        action={
          <SectionLink href={`/activity-log?objectType=booking&q=${encodeURIComponent(b.reference)}`}>
            {td("activityLog")}
          </SectionLink>
        }
      />
      <CardBody>
        <HistoryList
          empty={td("noHistory")}
          items={b.history.slice(0, 8).map((h) => ({
            key: h.id,
            title: actionLabel(h.action),
            meta: [h.actor?.fullName ?? td("system"), formatDateTime(h.createdAt, locale), h.note]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      </CardBody>
    </Card>
  );
}
