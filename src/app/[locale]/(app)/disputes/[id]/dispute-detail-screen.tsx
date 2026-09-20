"use client";

import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  FileText,
  FileUp,
  MessageCircle,
  MessageSquareMore,
  MoreHorizontal,
  SearchX,
  UserCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { FileTile, FileViewerDialog, type ViewerFile } from "@/components/domain/file-viewer";
import { HistoryList } from "@/components/domain/history-list";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { TwoColumn } from "@/components/layout/detail";
import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValueList } from "@/components/ui/key-value-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link, useRouter } from "@/i18n/navigation";
import { useAdminSocket } from "@/lib/api/admin-socket";
import {
  assignDispute,
  disputeKeys,
  getDispute,
  isActiveDispute,
  sendDisputeMessage,
  type DisputeDetail,
  type DisputeSide,
} from "@/lib/api/disputes";
import { ApiError } from "@/lib/api/errors";
import { conversationKeys, getConversation, type AdminMessage, type MessagesPage } from "@/lib/api/messaging";
import { formatDate, formatDateTime, formatMoney, initials } from "@/lib/utils/format";
import { Thread, upsertMessage } from "../../messages/inbox-thread";
import {
  AddEvidenceDialog,
  AskEvidenceDialog,
  CloseDisputeDialog,
  ResolveDisputeDialog,
} from "../dispute-dialogs";

type Overlay = "resolve" | "close" | "ask" | "evidence" | null;

export function DisputeDetailScreen({ id }: { id: string }) {
  const t = useTranslations("disputes");
  const td = useTranslations("disputes.detail");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: disputeKeys.detail(id), queryFn: () => getDispute(id) });
  const [overlay, setOverlay] = useState<Overlay>(null);

  const refresh = (detail?: DisputeDetail) => {
    if (detail) queryClient.setQueryData(disputeKeys.detail(id), detail);
    void queryClient.invalidateQueries({ queryKey: disputeKeys.all });
  };

  const assign = useMutation({
    mutationFn: () => assignDispute(query.data!.id),
    onSuccess: (d) => {
      refresh(d);
      toast.success(t("assigned", { reference: d.reference }));
    },
    onError: (e) => toast.apiError(e),
  });

  const conversationId = query.data?.conversationId ?? null;
  useAdminSocket(
    {
      onMessageNew: (m: AdminMessage) => {
        if (m.conversationId !== conversationId) return;
        queryClient.setQueryData<InfiniteData<MessagesPage, string | undefined>>(
          conversationKeys.messages(m.conversationId),
          (data) => upsertMessage(data, m, true),
        );
      },
      onConversationUpdated: (e) => {
        if (e.conversationId === conversationId) void query.refetch();
      },
    },
    conversationId,
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <CardSkeleton className="h-[90px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_370px]">
          <CardSkeleton className="h-[480px]" />
          <CardSkeleton className="h-[420px]" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/disputes" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={td("notFoundTitle")}
              description={td("notFoundDescription")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/disputes")}>
                  {td("back")}
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

  const d = query.data;
  const can = (a: DisputeDetail["allowedActions"][number]) => d.allowedActions.includes(a);
  const active = isActiveDispute(d.status);
  const opener =
    d.openedBy.role === "admin"
      ? td("openedByAdmin")
      : `${d.openedBy.fullName} (${t(`roles.${d.openedBy.role}`)})`;

  const moreMenu: ActionMenuItem[][] = [
    [
      {
        icon: <UserCheck />,
        label: t("menu.assignToMe"),
        disabled: !can("assign"),
        onSelect: () => assign.mutate(),
      },
      {
        icon: <FileUp />,
        label: td("addEvidence"),
        disabled: !can("add_evidence"),
        onSelect: () => setOverlay("evidence"),
      },
    ],
    [
      { icon: <FileText />, label: t("menu.openBooking"), href: `/bookings/${d.booking.id}` },
      { icon: <MessageCircle />, label: td("openInMessages"), href: `/messages/${d.conversationId}` },
      {
        icon: <UserRound />,
        label: td("blockUser", { name: d.against.fullName }),
        href: `/users/${d.against.id}`,
      },
      {
        icon: <FileText />,
        label: td("activityLog"),
        href: `/activity-log?objectType=dispute&q=${encodeURIComponent(d.reference)}`,
      },
    ],
    [
      {
        icon: <XCircle />,
        label: t("menu.close"),
        danger: true,
        disabled: !can("close"),
        onSelect: () => setOverlay("close"),
      },
    ],
  ];

  return (
    <>
      <PageHeader
        back
        breadcrumb={[{ label: t("title"), href: "/disputes" }, { label: d.reference }]}
        className="mb-3"
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 xl:flex-nowrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-26 font-semibold text-ink">
              {t(`types.${d.type}`)} · {d.reference}
            </h1>
            <StatusBadge domain="dispute" status={d.status} />
          </div>
          <p className="mt-1 text-14 text-muted">
            {[
              td("openedBy", { name: opener, date: formatDateTime(d.createdAt, locale) }),
              td("bookingRef", { reference: d.booking.reference }),
              td("event", { date: formatDate(`${d.booking.eventDate}T12:00:00`, locale) }),
              d.assignedAdmin ? td("assignedTo", { name: d.assignedAdmin.fullName }) : td("notAssigned"),
            ].join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {can("assign") && !d.assignedAdmin && (
            <Button
              variant="secondary"
              icon={<UserCheck />}
              loading={assign.isPending}
              onClick={() => assign.mutate()}
            >
              {t("menu.assignToMe")}
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<MessageSquareMore />}
            disabled={!can("request_evidence")}
            onClick={() => setOverlay("ask")}
          >
            {td("askEvidence")}
          </Button>
          <Button icon={<CheckCircle2 />} disabled={!can("resolve")} onClick={() => setOverlay("resolve")}>
            {td("resolve")}
          </Button>
          <ActionMenu
            groups={moreMenu}
            trigger={
              <IconButton label={td("more")} variant="outline">
                <MoreHorizontal />
              </IconButton>
            }
          />
        </div>
      </div>

      {active ? (
        <Banner
          tone="amber"
          icon={<Bell />}
          className="mb-4"
          title={td("frozen", { reference: d.booking.reference })}
        />
      ) : (
        <Banner
          tone={d.status === "resolved" ? "green" : "blue"}
          className="mb-4"
          title={
            d.status === "resolved"
              ? td("resolvedBanner", {
                  outcome: t(`resolve.outcomes.${d.bookingOutcome ?? "unchanged"}`),
                  name: d.resolvedBy?.fullName ?? "—",
                  date: d.resolvedAt ? formatDateTime(d.resolvedAt, locale) : "—",
                })
              : td("closedBanner", {
                  date: d.resolvedAt
                    ? formatDateTime(d.resolvedAt, locale)
                    : formatDateTime(d.updatedAt, locale),
                })
          }
          description={d.decisionNote}
        />
      )}

      <TwoColumn
        main={
          <>
            <BothSides dispute={d} />
            <EvidenceCard
              dispute={d}
              onAdd={can("add_evidence") ? () => setOverlay("evidence") : undefined}
            />
            <ConversationCard dispute={d} />
          </>
        }
        aside={
          <>
            <BookingCard dispute={d} />
            <PartyHistory dispute={d} />
            <TimelineCard dispute={d} />
          </>
        }
      />

      <ResolveDisputeDialog
        disputeId={d.id}
        dispute={d}
        open={overlay === "resolve"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={refresh}
      />
      <CloseDisputeDialog
        dispute={d}
        open={overlay === "close"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={refresh}
      />
      <AskEvidenceDialog
        dispute={d}
        open={overlay === "ask"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={refresh}
      />
      <AddEvidenceDialog
        dispute={d}
        open={overlay === "evidence"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={refresh}
      />
    </>
  );
}

/* ------------------------------------------------------------------ cards */

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-12 font-semibold text-brand">
      {initials(name)}
    </span>
  );
}

function SideColumn({ side, dispute }: { side: DisputeSide; dispute: DisputeDetail }) {
  const t = useTranslations("disputes");
  const td = useTranslations("disputes.detail");
  const locale = useLocale();
  const last = side.responses.at(-1);
  return (
    <div className="min-w-0 px-[18px] py-4">
      <div className="flex items-center gap-3">
        <Avatar name={side.fullName} src={side.avatarUrl} />
        <span className="min-w-0 leading-tight">
          <Link
            href={`/users/${side.id}`}
            className="block truncate text-14 font-medium text-brand hover:underline"
          >
            {side.businessName ?? side.fullName}
          </Link>
          <span className="block truncate text-12 text-muted">
            {t(`roles.${side.role}`)} · {side.isOpener ? td("openedTheDispute") : td("otherParty")}
          </span>
        </span>
      </div>
      {side.isOpener &&
        (side.description ?? (dispute.openedBy.role !== "admin" ? dispute.description : null)) && (
          <p className="mt-3 text-13 whitespace-pre-line text-ink">
            {side.description ?? dispute.description}
          </p>
        )}
      {!side.isOpener && (
        <p className={last ? "mt-3 text-13 whitespace-pre-line text-ink" : "mt-3 text-13 text-muted"}>
          {last ? last.body : td("noResponse")}
        </p>
      )}
      {side.isOpener && side.responses.length > 0 && (
        <p className="mt-2 text-12 text-muted">
          {td("messagesInChat", {
            count: side.responses.length,
            date: formatDate(side.responses.at(-1)!.createdAt, locale),
          })}
        </p>
      )}
      <p className="mt-2 text-12 font-medium text-brand">{td("filesCount", { count: side.evidenceCount })}</p>
    </div>
  );
}

function BothSides({ dispute: d }: { dispute: DisputeDetail }) {
  const td = useTranslations("disputes.detail");
  const opener = d.sides.client.isOpener ? d.sides.client : d.sides.provider;
  const other = opener === d.sides.client ? d.sides.provider : d.sides.client;
  return (
    <Card>
      <CardHeader title={td("bothSides")} />
      {d.openedBy.role === "admin" && (
        <p className="border-b border-border bg-canvas px-[18px] py-2.5 text-13 text-ink-2">
          <span className="font-medium text-ink">{td("adminDescription")}</span> {d.description}
        </p>
      )}
      <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border rtl:sm:divide-x-reverse">
        <SideColumn side={opener} dispute={d} />
        <SideColumn side={other} dispute={d} />
      </div>
    </Card>
  );
}

function EvidenceCard({ dispute: d, onAdd }: { dispute: DisputeDetail; onAdd?: () => void }) {
  const td = useTranslations("disputes.detail");
  const locale = useLocale();
  const [index, setIndex] = useState<number | null>(null);
  const files: ViewerFile[] = d.evidence
    .filter((e) => e.file)
    .map((e) => ({
      id: e.id,
      name: e.file!.name,
      mimeType: e.file!.mimeType,
      url: e.file!.url,
      sizeBytes: e.file!.sizeBytes,
      meta: `${e.uploadedBy.fullName} · ${formatDate(e.createdAt, locale)}${e.note ? ` · ${e.note}` : ""}`,
    }));
  return (
    <Card>
      <CardHeader
        title={td("evidence")}
        subtitle={td("evidencePrivate")}
        actions={
          onAdd && (
            <Button variant="secondary" size="sm" icon={<FileUp />} onClick={onAdd}>
              {td("addEvidence")}
            </Button>
          )
        }
      />
      <CardBody>
        {d.evidence.length === 0 ? (
          <p className="text-13 text-muted">{td("noEvidence")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {d.evidence.map((e) => {
              if (e.kind === "chat_snapshot") {
                return (
                  <li key={e.id}>
                    <Link href={`/messages/${e.conversationId ?? ""}`} className="block">
                      <FileTile
                        icon={<MessageCircle />}
                        file={{
                          name: td("chatSnapshot", { reference: d.booking.reference }),
                          meta: td("autoAttached"),
                        }}
                      />
                    </Link>
                  </li>
                );
              }
              const i = files.findIndex((f) => f.id === e.id);
              return (
                <li key={e.id}>
                  <FileTile
                    file={{
                      name: e.file?.name ?? e.note ?? td("note"),
                      mimeType: e.file?.mimeType,
                      url: e.file?.url,
                      meta: `${e.uploadedBy.fullName} · ${formatDate(e.createdAt, locale)}`,
                    }}
                    onOpen={i >= 0 ? () => setIndex(i) : undefined}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
      <FileViewerDialog files={files} index={index} onIndexChange={setIndex} onClose={() => setIndex(null)} />
    </Card>
  );
}

function ConversationCard({ dispute: d }: { dispute: DisputeDetail }) {
  const td = useTranslations("disputes.detail");
  const conversation = useQuery({
    queryKey: conversationKeys.detail(d.conversationId),
    queryFn: () => getConversation(d.conversationId),
  });
  const names = [
    d.sides.client.fullName,
    d.sides.provider.businessName ?? d.sides.provider.fullName,
    "Eventor",
  ].join(", ");
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title={td("conversation", { names })}
        action={
          <Link
            href={`/messages/${d.conversationId}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            {td("openInMessages")} <ChevronRight className="flip-rtl size-4" aria-hidden />
          </Link>
        }
      />
      <div className="flex h-[400px] min-h-0 flex-col">
        {conversation.isPending ? (
          <CardSkeleton className="m-4 h-40 border-0" />
        ) : conversation.isError ? (
          <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />
        ) : (
          <Thread
            conversation={conversation.data}
            moderation={false}
            placeholder={td("composerPlaceholder")}
            send={(body) => sendDisputeMessage(d.id, body)}
            closedSlot={
              d.conversationStatus === "closed" ? (
                <p className="text-13 text-muted">{td("chatClosed")}</p>
              ) : undefined
            }
          />
        )}
      </div>
    </Card>
  );
}

function BookingCard({ dispute: d }: { dispute: DisputeDetail }) {
  const td = useTranslations("disputes.detail");
  const tb = useTranslations("status.booking");
  const locale = useLocale();
  const b = d.booking;
  const date = formatDate(`${b.eventDate}T12:00:00`, locale);
  const time = b.startTime && b.endTime ? ` · ${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)}` : "";
  return (
    <Card>
      <CardHeader
        title={td("booking")}
        action={
          <Link href={`/bookings/${b.id}`} className="hover:underline">
            {td("openBooking")}
          </Link>
        }
      />
      <CardBody className="py-2">
        <KeyValueList
          rows={[
            { label: td("reference"), value: `#${b.reference}`, href: `/bookings/${b.id}` },
            {
              label: b.kind === "pack" ? td("pack") : td("service"),
              value: locale === "ar" ? b.titleAr || b.titleEn : b.titleEn,
            },
            { label: td("eventLabel"), value: <span dir="ltr">{`${date}${time}`}</span> },
            {
              label: td("status"),
              value: isActiveDispute(d.status) ? td("statusFrozen", { status: tb(b.status) }) : tb(b.status),
            },
            { label: td("total"), value: formatMoney(b.total, locale) },
            ...(b.cancelReason ? [{ label: td("cancelReason"), value: b.cancelReason }] : []),
            {
              label: td("invoice"),
              value: b.invoiceNumber ?? "—",
              href: b.invoiceNumber ? `/bookings/${b.id}?invoice=1` : undefined,
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function PartyHistory({ dispute: d }: { dispute: DisputeDetail }) {
  const td = useTranslations("disputes.detail");
  const row = (s: DisputeSide): ReactNode => {
    const repeat = s.history.disputesCount > 1 || s.history.cancellationsCount >= 2;
    return (
      <li key={s.id} className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/users/${s.id}`} className="text-13 font-medium text-brand hover:underline">
            {s.businessName ?? s.fullName}
          </Link>
          <Pill tone={repeat ? "red" : "green"}>{repeat ? td("repeatIssues") : td("clean")}</Pill>
        </div>
        <p className="mt-0.5 text-12 text-muted">
          {[
            td("disputesCount", { count: s.history.disputesCount }),
            td("cancellationsCount", { count: s.history.cancellationsCount }),
            s.history.ratingAvg ? td("rating", { rating: s.history.ratingAvg.toFixed(1) }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <Link
          href={`/disputes?tab=all&userId=${s.id}`}
          className="text-12 font-medium text-brand hover:underline"
        >
          {td("theirDisputes")}
        </Link>
      </li>
    );
  };
  return (
    <Card>
      <CardHeader title={td("history")} />
      <ul className="divide-y divide-border px-[18px] py-1">
        {[row(d.sides.provider), row(d.sides.client)]}
      </ul>
    </Card>
  );
}

function TimelineCard({ dispute: d }: { dispute: DisputeDetail }) {
  const td = useTranslations("disputes.detail");
  const locale = useLocale();
  const label = (type: string, data: Record<string, unknown> | null) => {
    const key = `timeline.${type}`;
    return td.has(key)
      ? td(key, { value: String(data?.bookingOutcome ?? data?.fullName ?? "") })
      : type.replace(/_/g, " ");
  };
  const items = [...d.timeline]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => ({
      key: e.id,
      title: label(e.type, e.data),
      meta: [e.actor?.fullName ?? td("system"), formatDateTime(e.createdAt, locale)].join(" · "),
    }));
  items.push({
    key: "event-date",
    title: td("timeline.eventDate"),
    meta: formatDate(`${d.booking.eventDate}T12:00:00`, locale),
  });
  return (
    <Card>
      <CardHeader title={td("timelineTitle")} />
      <CardBody>
        <HistoryList items={items} empty={td("noHistory")} />
      </CardBody>
    </Card>
  );
}
