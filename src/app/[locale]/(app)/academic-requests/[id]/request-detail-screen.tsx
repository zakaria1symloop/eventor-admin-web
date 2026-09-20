"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  SearchX,
  Trash2,
  UserCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { FileViewerDialog, formatBytes, type ViewerFile } from "@/components/domain/file-viewer";
import { HistoryList } from "@/components/domain/history-list";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Field, TextInput } from "@/components/forms/fields";
import { AsyncSelect, type Option } from "@/components/forms/select-inputs";
import { TwoColumn } from "@/components/layout/detail";
import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link, useRouter } from "@/i18n/navigation";
import {
  addProposal,
  assignRequest,
  getRequest,
  removeProposal,
  requestKeys,
  type Proposal,
  type RequestDetail,
} from "@/lib/api/academic-requests";
import { ApiError } from "@/lib/api/errors";
import { formKeys, getFormVersion } from "@/lib/api/forms";
import { fieldLabel, toSchema } from "@/lib/forms/schema";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDateTime, formatDzPhone, formatMoney } from "@/lib/utils/format";
import { useActionLabel } from "../../activity-log/action-label";
import { localName } from "../../users/use-user-options";
import {
  ApproveDialog,
  BookProposalDialog,
  CancelRequestDialog,
  RejectPanel,
  RequestChangesDialog,
  useServiceSearch,
} from "../request-dialogs";

export function RequestDetailScreen({ id }: { id: string }) {
  const t = useTranslations("academic");
  const td = useTranslations("academic.detail");
  const tpk = useTranslations("packs");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: requestKeys.detail(id), queryFn: () => getRequest(id) });
  const [action, setAction] = useQueryState("action", parseAsString.withOptions({ history: "replace" }));
  const [cancelling, setCancelling] = useState(false);

  const assign = useMutation({
    mutationFn: () => assignRequest(query.data!.id),
    onSuccess: (r) => {
      queryClient.setQueryData(requestKeys.detail(id), r);
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      toast.success(t("assigned", { reference: r.reference }));
    },
    onError: (e) => toast.apiError(e),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <CardSkeleton className="h-[90px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_370px]">
          <CardSkeleton className="h-[480px]" />
          <CardSkeleton className="h-[360px]" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/academic-requests" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={td("notFoundTitle")}
              description={td("notFoundDescription")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/academic-requests")}>
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

  const r = query.data;
  const can = (a: RequestDetail["allowedActions"][number]) => r.allowedActions.includes(a);
  const formName = locale === "ar" ? r.form.nameAr || r.form.nameEn : r.form.nameEn;

  const moreMenu: ActionMenuItem[][] = [
    [
      {
        icon: <UserCheck />,
        label: t("menu.assignToMe"),
        disabled: !can("assign"),
        onSelect: () => assign.mutate(),
      },
      ...(r.requester.userId
        ? [
            { icon: <UserRound />, label: td("openAccount"), href: `/users/${r.requester.userId}` },
            {
              icon: <MessageCircle />,
              label: td("message"),
              href: `/messages?new=1&to=${r.requester.userId}`,
            },
          ]
        : []),
      { icon: <FileText />, label: td("viewForm"), href: `/academic-requests/forms/${r.form.id}/edit` },
      {
        icon: <FileText />,
        label: td("activityLog"),
        href: `/activity-log?q=${encodeURIComponent(r.reference)}`,
      },
    ],
    [
      {
        icon: <XCircle />,
        label: td("cancel"),
        danger: true,
        disabled: !can("cancel"),
        onSelect: () => setCancelling(true),
      },
    ],
  ];

  return (
    <>
      <PageHeader
        back
        breadcrumb={[{ label: t("title"), href: "/academic-requests" }, { label: `#${r.reference}` }]}
        className="mb-3"
      />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 xl:flex-nowrap">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold [&_svg]:size-6">
            <GraduationCap />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-26 font-semibold text-ink">{r.title}</h1>
              <StatusBadge domain="request" status={r.status} />
            </div>
            <p className="mt-1 text-14 text-muted">
              {[
                `#${r.reference}`,
                td("form", { name: formName, version: r.form.version }),
                td("by", { name: r.institutionName ?? r.requester.name }),
                td("submitted", { date: formatDate(r.submittedAt, locale) }),
                r.eventDate ? td("event", { date: formatDate(`${r.eventDate}T12:00:00`, locale) }) : null,
                r.assignedAdmin ? td("assignedTo", { name: r.assignedAdmin.fullName }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {can("assign") && !r.assignedAdmin && (
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
            icon={<Pencil />}
            disabled={!can("request_changes")}
            onClick={() => void setAction("changes")}
          >
            {t("menu.askChanges")}
          </Button>
          <Button
            variant="secondary"
            icon={<X />}
            disabled={!can("reject")}
            onClick={() => void setAction("reject")}
          >
            {t("menu.reject")}
          </Button>
          <Button icon={<Check />} disabled={!can("approve")} onClick={() => void setAction("approve")}>
            {td("approve")}
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

      {r.status === "changes_requested" && r.requestedChanges && (
        <Banner
          tone="amber"
          className="mb-4"
          title={td("changesRequested", {
            date: formatDateTime(r.requestedChanges.requestedAt, locale),
            name: r.requestedChanges.requestedBy?.fullName ?? "—",
          })}
          description={`${r.requestedChanges.message}${
            r.requestedChanges.linkExpiresAt
              ? ` · ${td("linkExpires", { date: formatDate(r.requestedChanges.linkExpiresAt, locale) })}`
              : ""
          }`}
        />
      )}
      {r.changedFields.length > 0 && r.status !== "changes_requested" && (
        <Banner
          tone="blue"
          className="mb-4"
          title={td("resubmitted", { count: r.changedFields.length })}
          description={r.answers
            .filter((a) => r.changedFields.includes(a.key))
            .map((a) => (locale === "ar" ? a.labelAr || a.labelEn : a.labelEn))
            .join(", ")}
        />
      )}
      {(r.status === "rejected" || r.status === "cancelled") && (
        <Banner
          tone={r.status === "rejected" ? "red" : "gray"}
          className="mb-4"
          title={td(r.status === "rejected" ? "rejectedBanner" : "cancelledBanner", {
            reason: r.rejectReason
              ? t.has(`reject.reasons.${r.rejectReason}`)
                ? t(`reject.reasons.${r.rejectReason}`)
                : r.rejectReason
              : "—",
            name: r.decidedBy?.fullName ?? "—",
          })}
          description={r.decisionMessage}
        />
      )}

      <TwoColumn
        main={
          <>
            <AnswersCard request={r} />
            <ProposalsCard request={r} />
            {r.bookings.length > 0 && <BookingsCard request={r} />}
          </>
        }
        aside={
          <>
            <RequesterCard request={r} />
            {action === "reject" && can("reject") && (
              <RejectPanel request={r} onCancel={() => void setAction(null)} />
            )}
            <NeedsCard request={r} eventType={r.eventType ? tpk(`eventTypes.${r.eventType}`) : null} />
            <TimelineCard request={r} />
          </>
        }
      />

      <ApproveDialog
        request={r}
        open={action === "approve" && can("approve")}
        onOpenChange={(o) => !o && void setAction(null)}
      />
      <RequestChangesDialog
        request={r}
        open={action === "changes" && can("request_changes")}
        onOpenChange={(o) => !o && void setAction(null)}
      />
      <CancelRequestDialog request={r} open={cancelling} onOpenChange={setCancelling} />
    </>
  );
}

/* ------------------------------------------------------------------ answers */

function AnswersCard({ request: r }: { request: RequestDetail }) {
  const td = useTranslations("academic.detail");
  const locale = useLocale();
  const version = useQuery({
    queryKey: formKeys.version(r.form.id, r.form.versionId),
    queryFn: () => getFormVersion(r.form.id, r.form.versionId),
    staleTime: Infinity,
  });
  const schema = toSchema(version.data?.schema);
  const sectionLabel = (key: string | null) => {
    const f = key ? schema.fields.find((x) => x.key === key && x.type === "section") : undefined;
    return f ? fieldLabel(f, locale) : null;
  };
  const files: ViewerFile[] = r.attachments.map((a) => ({
    id: a.id,
    name: a.fileName,
    mimeType: a.mimeType,
    url: a.url,
    sizeBytes: a.sizeBytes,
    meta: formatBytes(a.sizeBytes, locale),
  }));
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader title={td("answers")} subtitle={td("answersVersion", { version: r.form.version })} />
      <dl className="px-[18px] py-2">
        {r.answers.map((a, index) => {
          const heading =
            index === 0 || a.section !== r.answers[index - 1].section ? sectionLabel(a.section) : null;
          const changed = r.changedFields.includes(a.key) || a.changed;
          const attachments = files.filter((_, i) => r.attachments[i].fieldKey === a.key);
          return (
            <Fragment key={a.key}>
              {heading && (
                <dt className="mt-3 mb-1 text-11 font-medium tracking-wide text-muted uppercase first:mt-1">
                  {heading}
                </dt>
              )}
              <div
                className={cn(
                  "grid gap-1 rounded-md py-2 text-13 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4",
                  changed && "-mx-2 bg-amber-soft px-2",
                )}
                data-changed={changed || undefined}
              >
                <dt className="text-muted">
                  {locale === "ar" ? a.labelAr || a.labelEn : a.labelEn || a.labelAr}
                  {changed && (
                    <Pill tone="amber" className="ms-2">
                      {td("changed")}
                    </Pill>
                  )}
                </dt>
                <dd className="min-w-0 break-words whitespace-pre-line text-ink" dir="auto">
                  {a.type === "file" && attachments.length > 0 ? (
                    <span className="flex flex-col gap-1">
                      {attachments.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setViewing(files.indexOf(f))}
                          className="inline-flex items-center gap-1.5 text-start font-medium text-brand hover:underline"
                        >
                          <FileText className="size-4" aria-hidden />
                          {f.name}
                        </button>
                      ))}
                    </span>
                  ) : (
                    (a.displayValue ?? <span className="text-faint">{td("noAnswer")}</span>)
                  )}
                </dd>
              </div>
            </Fragment>
          );
        })}
      </dl>
      {r.attachments.length > 0 && (
        <div className="border-t border-border">
          <div className="px-[18px] pt-3 text-13 font-medium text-ink">
            {td("attachments", { count: r.attachments.length })}
          </div>
          <ul className="divide-y divide-border">
            {files.map((f, i) => (
              <li key={f.id} className="flex items-center gap-3 px-[18px] py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-13 font-medium text-ink">{f.name}</span>
                  <span className="block text-12 text-muted">{f.meta}</span>
                </span>
                <Button variant="secondary" size="sm" icon={<Eye />} onClick={() => setViewing(i)}>
                  {td("preview")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FileViewerDialog
        files={files}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ proposals & bookings */

function ProposalsCard({ request: r }: { request: RequestDetail }) {
  const t = useTranslations("academic.proposals");
  const tbs = useTranslations("status.booking");
  const tsv = useTranslations("services");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const search = useServiceSearch(r);
  const [service, setService] = useState<Option | null>(null);
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState<Proposal | null>(null);
  const canPropose = r.allowedActions.includes("propose");
  const canBook = r.allowedActions.includes("book");
  const needs = new Set(r.needs.map((n) => n.category.id));
  const apply = (detail: RequestDetail) => {
    queryClient.setQueryData(requestKeys.detail(r.id), detail);
    void queryClient.invalidateQueries({ queryKey: requestKeys.all });
  };
  const add = useMutation({
    mutationFn: () => addProposal(r.id, { serviceId: service!.value, note: note.trim() || null }),
    onSuccess: (d) => {
      apply(d);
      setService(null);
      setNote("");
      toast.success(t("added"));
    },
    onError: (e) => toast.apiError(e),
  });
  const remove = useMutation({
    mutationFn: (proposalId: string) => removeProposal(r.id, proposalId),
    onSuccess: (d) => {
      apply(d);
      toast.success(t("removed"));
    },
    onError: (e) => toast.apiError(e),
  });
  const searchHref = `/services?tab=published${r.wilaya ? `&wilaya=${r.wilaya.code}` : ""}${
    r.needs[0] ? `&categoryId=${r.needs[0].category.id}` : ""
  }`;
  return (
    <Card>
      <CardHeader
        title={t("title", { count: r.proposals.length })}
        action={
          <Link href={searchHref} className="inline-flex items-center gap-1 hover:underline">
            {t("searchServices")} <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        }
      />
      {r.proposals.length === 0 ? (
        <p className="px-[18px] py-4 text-13 text-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {r.proposals.map((p) => {
            const title = locale === "ar" ? p.service.titleAr || p.service.titleEn : p.service.titleEn;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
                <span className="min-w-0 flex-1 leading-tight">
                  <Link
                    href={`/services/${p.service.id}`}
                    className="block truncate text-14 font-medium text-brand hover:underline"
                  >
                    {title}
                  </Link>
                  <span className="block truncate text-12 text-muted">
                    {[
                      p.service.businessName ?? p.service.provider.fullName,
                      localName(p.service.category, locale),
                      `${formatMoney(p.service.basePrice, locale)} ${tsv.has(`priceTypesShort.${p.service.priceType}`) ? tsv(`priceTypesShort.${p.service.priceType}`) : ""}`,
                      p.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {needs.has(p.service.category.id) && <Pill tone="green">{t("fits")}</Pill>}
                {p.booking ? (
                  <Link
                    href={`/bookings/${p.booking.id}`}
                    className="inline-flex items-center gap-1.5 text-13 font-medium text-brand hover:underline"
                  >
                    #{p.booking.reference}{" "}
                    <StatusBadge domain="booking" status={p.booking.status} label={tbs(p.booking.status)} />
                  </Link>
                ) : (
                  <>
                    <Button
                      size="sm"
                      icon={<CalendarPlus />}
                      disabled={!canBook}
                      onClick={() => setBooking(p)}
                    >
                      {t("createBooking")}
                    </Button>
                    <IconButton
                      label={t("remove", { name: title })}
                      size="sm"
                      disabled={!canPropose || remove.isPending}
                      onClick={() => remove.mutate(p.id)}
                    >
                      <Trash2 />
                    </IconButton>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canPropose && (
        <div className="flex flex-col gap-3 border-t border-border bg-canvas/60 px-[18px] py-3 sm:flex-row sm:items-end">
          <Field label={t("service")} className="min-w-0 flex-[2]">
            <AsyncSelect
              value={service}
              onValueChange={setService}
              queryKey={[...requestKeys.detail(r.id), "services"]}
              queryFn={search}
              placeholder={t("servicePlaceholder")}
            />
          </Field>
          <Field label={t("note")} className="min-w-0 flex-1">
            <TextInput value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button icon={<Plus />} disabled={!service} loading={add.isPending} onClick={() => add.mutate()}>
            {t("suggest")}
          </Button>
        </div>
      )}
      {!canBook && canPropose && r.proposals.length > 0 && (
        <p className="border-t border-border px-[18px] py-2.5 text-12 text-muted">{t("approveFirst")}</p>
      )}
      <BookProposalDialog request={r} proposal={booking} onOpenChange={(o) => !o && setBooking(null)} />
    </Card>
  );
}

function BookingsCard({ request: r }: { request: RequestDetail }) {
  const t = useTranslations("academic.detail");
  const locale = useLocale();
  return (
    <Card>
      <CardHeader
        title={t("bookings", { count: r.bookings.length })}
        action={
          <Link href={`/bookings?academicRequest=${r.id}`} className="hover:underline">
            {t("viewAll")}
          </Link>
        }
      />
      <ul className="divide-y divide-border">
        {r.bookings.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-[18px] py-3">
            <span className="min-w-0 flex-1 leading-tight">
              <Link
                href={`/bookings/${b.id}`}
                className="block truncate text-14 font-medium text-brand hover:underline"
              >
                #{b.reference} · {b.titleEn ?? "—"}
              </Link>
              <span className="block text-12 text-muted">
                {b.provider.fullName} · {formatDate(`${b.eventDate}T12:00:00`, locale)} ·{" "}
                {formatMoney(b.total, locale)}
              </span>
            </span>
            <StatusBadge domain="booking" status={b.status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ aside */

function RequesterCard({ request: r }: { request: RequestDetail }) {
  const td = useTranslations("academic.detail");
  const q = r.requester;
  return (
    <Card>
      <CardHeader
        title={td("requester")}
        action={
          q.userId ? (
            <Link href={`/users/${q.userId}`} className="hover:underline">
              {td("openProfile")}
            </Link>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-3">
        <div className="leading-tight">
          <div className="text-15 font-medium text-ink">{r.institutionName ?? q.name}</div>
          <div className="text-12 text-muted">
            {r.institutionName ? `${q.name} · ` : ""}
            {q.userId ? td("linkedAccount") : td("noAccount")}
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-13">
          <li className="flex items-center gap-2">
            <Mail className="size-4 text-muted" aria-hidden />
            <a href={`mailto:${q.email}`} className="truncate text-brand hover:underline" dir="ltr">
              {q.email}
            </a>
          </li>
          <li className="flex items-center gap-2">
            <Phone className="size-4 text-muted" aria-hidden />
            <a href={`tel:${q.phone}`} className="text-ink hover:underline" dir="ltr">
              {formatDzPhone(q.phone)}
            </a>
          </li>
        </ul>
        {!q.userId && <Banner tone="amber" title={td("noAccountHint")} />}
        <Link
          href={`/academic-requests?tab=all&q=${encodeURIComponent(q.email)}`}
          className="text-13 font-medium text-brand hover:underline"
        >
          {td("otherRequests")}
        </Link>
      </CardBody>
    </Card>
  );
}

function NeedsCard({ request: r, eventType }: { request: RequestDetail; eventType: string | null }) {
  const td = useTranslations("academic.detail");
  const locale = useLocale();
  return (
    <Card>
      <CardHeader title={td("summary")} />
      <CardBody className="flex flex-col gap-3 text-13">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted">{td("eventType")}</dt>
          <dd className="text-end text-ink">{eventType ?? "—"}</dd>
          <dt className="text-muted">{td("date")}</dt>
          <dd className="text-end text-ink">
            {r.eventDate ? formatDate(`${r.eventDate}T12:00:00`, locale) : "—"}
          </dd>
          <dt className="text-muted">{td("wilaya")}</dt>
          <dd className="text-end text-ink">{r.wilaya ? localName(r.wilaya, locale) : "—"}</dd>
          <dt className="text-muted">{td("attendees")}</dt>
          <dd className="text-end text-ink">{r.attendees ?? "—"}</dd>
          <dt className="text-muted">{td("budget")}</dt>
          <dd className="text-end text-ink" dir="ltr">
            {r.budgetMin || r.budgetMax
              ? `${formatMoney(r.budgetMin, locale)} – ${formatMoney(r.budgetMax, locale)}`
              : "—"}
          </dd>
        </dl>
        <div>
          <div className="mb-1.5 text-11 font-medium tracking-wide text-muted uppercase">{td("needs")}</div>
          {r.needs.length === 0 ? (
            <p className="text-muted">{td("noNeeds")}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {r.needs.map((n) => (
                <li
                  key={n.category.id}
                  className="rounded-pill border border-border px-2.5 py-0.5 text-12 text-ink"
                >
                  {localName(n.category, locale)}
                  {n.note ? ` · ${n.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function TimelineCard({ request: r }: { request: RequestDetail }) {
  const td = useTranslations("academic.detail");
  const locale = useLocale();
  const actionLabel = useActionLabel();
  return (
    <Card>
      <CardHeader
        title={td("history")}
        action={
          <Link href={`/activity-log?q=${encodeURIComponent(r.reference)}`} className="hover:underline">
            {td("activityLog")}
          </Link>
        }
      />
      <CardBody>
        <HistoryList
          empty={td("noHistory")}
          items={[...r.timeline]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((e) => ({
              key: e.id,
              title: actionLabel(e.action),
              meta: [e.actor?.fullName ?? td("requesterActor"), formatDateTime(e.createdAt, locale), e.note]
                .filter(Boolean)
                .join(" · "),
            }))}
        />
      </CardBody>
    </Card>
  );
}
