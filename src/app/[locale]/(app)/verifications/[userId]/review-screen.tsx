"use client";

import { PdfFrame } from "@/components/domain/file-viewer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  FileText,
  Minus,
  Plus,
  RotateCw,
  Undo2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { userKeys } from "@/lib/api/users";
import {
  approveDocument,
  getVerification,
  rejectDocument,
  undoDocument,
  verificationKeys,
  type DocumentSlot,
  type ReviewDocument,
  type VerificationDetail,
} from "@/lib/api/verifications";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDzPhone, initials } from "@/lib/utils/format";
import { localName } from "../../users/use-user-options";
import { RejectDocumentDialog, UploadDocumentDialog } from "./reject-dialog";
import { useReviewShortcuts } from "./use-review-shortcuts";

const LIST_KEYS = ["tab", "q", "sort", "categoryId", "wilaya", "documentType", "submitted"] as const;

export function ReviewScreen({ userId }: { userId: string }) {
  const t = useTranslations("verifications.review");
  const tv = useTranslations("verifications");
  const tu = useTranslations("users");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [url, setUrl] = useQueryStates(
    {
      doc: parseAsString,
      tab: parseAsString,
      q: parseAsString,
      sort: parseAsString,
      categoryId: parseAsString,
      wilaya: parseAsString,
      documentType: parseAsString,
      submitted: parseAsString,
    },
    { history: "replace" },
  );
  const listState: Record<string, string> = {};
  for (const k of LIST_KEYS) if (url[k]) listState[k] = url[k]!;
  const [from = "", to = ""] = (url.submitted ?? "").split("..");
  const apiQuery = {
    tab: url.tab ?? "waiting",
    q: url.q ?? undefined,
    sort: url.sort ?? undefined,
    categoryId: url.categoryId ?? undefined,
    wilaya: url.wilaya ? url.wilaya.split(",") : undefined,
    documentType: url.documentType ?? undefined,
    submittedFrom: from || undefined,
    submittedTo: to || undefined,
  };
  const search = new URLSearchParams(listState).toString();
  const withSearch = (path: string) => (search ? `${path}?${search}` : path);

  const query = useQuery({
    queryKey: verificationKeys.detail(userId, apiQuery),
    queryFn: () => getVerification(userId, apiQuery),
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = query.data;
  const slots = data?.documents ?? [];
  const selectedSlot =
    slots.find((d) => d.type === url.doc) ??
    slots.find((d) => d.current?.status === "pending") ??
    slots.find((d) => d.current) ??
    slots[0];
  const selected = selectedSlot?.current ?? undefined;
  const n = data?.neighbours;
  const verified = data?.verificationStatus === "verified";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: verificationKeys.all });
    void queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
  };
  const goTo = (id: string | null | undefined) => id && router.push(withSearch(`/verifications/${id}`));
  const docLabel = (d: { type: DocumentSlot["type"] }) => tu(`documentTypes.${d.type}`);

  function nextPendingAfter(current: ReviewDocument) {
    const i = slots.findIndex((d) => d.type === current.type);
    return [...slots.slice(i + 1), ...slots.slice(0, i)].find((d) => d.current?.status === "pending");
  }

  async function decide(
    doc: ReviewDocument,
    action: "approve" | "reject",
    body?: Parameters<typeof rejectDocument>[1],
  ) {
    setBusy(true);
    try {
      const res = action === "approve" ? await approveDocument(doc.id) : await rejectDocument(doc.id, body!);
      const becameVerified =
        res.verificationStatus === "verified" && res.previousVerificationStatus !== "verified";
      const undo = {
        label: tu("undo"),
        onClick: () => {
          undoDocument(doc.id).then(
            () => {
              toast.success(t("undone", { document: docLabel(doc) }));
              refresh();
            },
            (e) => toast.apiError(e),
          );
        },
      };
      const name = data?.account.businessName || data?.account.fullName || "";
      if (becameVerified) {
        toast.success(t("verifiedToast", { name }), {
          description: t("verifiedToastHint"),
          action: undo,
        });
      } else {
        toast.success(
          action === "approve"
            ? t("approvedToast", { document: docLabel(doc) })
            : t("rejectedToast", { document: docLabel(doc) }),
          {
            description: action === "reject" ? t("rejectedToastHint") : undefined,
            action: undo,
          },
        );
        const next = nextPendingAfter(doc);
        if (next) void setUrl({ doc: next.type });
      }
      refresh();
    } catch (e) {
      if (action === "reject") throw e;
      toast.apiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function undoDecision(doc: ReviewDocument) {
    setBusy(true);
    try {
      await undoDocument(doc.id);
      toast.success(t("undone", { document: docLabel(doc) }));
      refresh();
    } catch (e) {
      toast.apiError(e);
    } finally {
      setBusy(false);
    }
  }

  const canDecide = !!selected && selected.status === "pending" && !busy;
  useReviewShortcuts({
    enabled: !!data,
    onApprove: () => canDecide && void decide(selected!, "approve"),
    onReject: () => canDecide && setRejectOpen(true),
    onNext: () => goTo(n?.nextUserId),
    onPrev: () => goTo(n?.prevUserId),
  });

  const tabLabel = tv(`tabs.${url.tab ?? "waiting"}`);

  if (query.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_340px]" aria-busy="true">
        <CardSkeleton className="h-[240px]" />
        <CardSkeleton className="h-[560px]" />
        <CardSkeleton className="h-[320px]" />
      </div>
    );
  }
  if (query.isError || !data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader
          back
          breadcrumb={[{ label: tv("title"), href: withSearch("/verifications") }, { label: "—" }]}
        />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<UserRound />}
              title={t("notFoundTitle")}
              description={t("notFoundDescription")}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    );
  }

  const u = data.account;
  const p = data.progress;
  const total = slots.length || 3;
  const latestSubmitted = slots.reduce<string | null>(
    (acc, d) => (d.current && (!acc || d.current.uploadedAt > acc) ? d.current.uploadedAt : acc),
    null,
  );

  return (
    <>
      <PageHeader
        back
        breadcrumb={[
          { label: tv("title"), href: withSearch("/verifications") },
          { label: tabLabel, href: withSearch("/verifications") },
          { label: u.fullName },
        ]}
        className="mb-3"
      />
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-14 font-semibold text-brand">
          {initials(u.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-22 font-semibold text-ink">
              {[u.fullName, u.businessName].filter(Boolean).join(" · ")}
            </h1>
            <StatusBadge domain="role" status="provider" />
            {verified ? (
              <StatusBadge domain="document" status="verified" label={tu("verification.verified")} />
            ) : (
              data.status && <StatusBadge domain="verification" status={data.status} />
            )}
          </div>
          <p className="mt-0.5 text-13 text-muted">
            {[
              u.wilaya ? localName(u.wilaya, locale) : null,
              u.category ? localName(u.category, locale) : null,
              latestSubmitted ? t("submitted", { date: formatDate(latestSubmitted, locale) }) : null,
              t("approvedOf", { approved: p.approved, total }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {n?.position != null && (
            <span className="text-13 text-ink-2 tabular-nums">
              {t("queue", { position: n.position, total: n.total })}
            </span>
          )}
          <IconButton
            label={t("prev")}
            variant="outline"
            disabled={!n?.prevUserId}
            onClick={() => goTo(n?.prevUserId)}
          >
            <ChevronLeft className="flip-rtl" />
          </IconButton>
          <IconButton
            label={t("next")}
            variant="outline"
            disabled={!n?.nextUserId}
            onClick={() => goTo(n?.nextUserId)}
          >
            <ChevronRight className="flip-rtl" />
          </IconButton>
          <Button variant="secondary" icon={<UserRound />} onClick={() => router.push(`/users/${u.id}`)}>
            {t("openProfile")}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* documents */}
        <Card className="overflow-hidden">
          <CardHeader title={t("documents")} />
          <ul role="listbox" aria-label={t("documents")}>
            {slots.map((slot) => {
              const on = slot.type === selectedSlot?.type;
              const d = slot.current;
              return (
                <li key={slot.type} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => void setUrl({ doc: slot.type })}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-start transition-colors",
                      on ? "bg-brand-soft" : "hover:bg-canvas",
                    )}
                  >
                    <DocIcon status={d?.status ?? "missing"} />
                    <span className="min-w-0 leading-tight">
                      <span className={cn("block text-13 font-medium", on ? "text-brand" : "text-ink")}>
                        {docLabel(slot)}
                      </span>
                      <span className="block text-12 text-muted">
                        {!d
                          ? tu("documentStatus.missing")
                          : d.status === "pending" && slot.previous.length > 0
                            ? t("sentAgain", { date: formatDate(d.uploadedAt, locale) })
                            : `${tu(`documentStatus.${d.status}`)} · ${formatDate(d.reviewedAt ?? d.uploadedAt, locale)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border p-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload />}
              className="w-full"
              onClick={() => setUploadOpen(true)}
            >
              {t("uploadOnBehalf")}
            </Button>
          </div>
        </Card>

        {/* viewer */}
        {selected ? (
          <DocumentViewer key={selected.id} doc={selected} label={docLabel(selected)} />
        ) : (
          <Card>
            <EmptyState
              icon={<FileText />}
              title={
                selectedSlot ? t("notSubmitted", { document: docLabel(selectedSlot) }) : t("noDocuments")
              }
              description={t("noDocumentsHint")}
              actions={[
                <Button
                  key="upload"
                  variant="secondary"
                  icon={<Upload />}
                  onClick={() => setUploadOpen(true)}
                >
                  {t("uploadOnBehalf")}
                </Button>,
              ]}
            />
          </Card>
        )}

        {/* side panel */}
        <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-1">
          <CheckAgainstAccount detail={data} />
          {selectedSlot && <PreviousDecision slot={selectedSlot} />}
          {verified ? (
            <div className="rounded-xl border border-green/30 bg-green-soft p-4" role="status">
              <h2 className="text-15 font-semibold text-green">{t("verifiedTitle")}</h2>
              <p className="mt-1 text-13 text-ink-2">
                {t("verifiedDescription", { total, name: u.businessName || u.fullName })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  icon={<ChevronRight className="flip-rtl" />}
                  disabled={!n?.nextUserId}
                  onClick={() => goTo(n?.nextUserId)}
                >
                  {t("nextInQueue")}
                </Button>
                <Button
                  variant="secondary"
                  icon={<UserRound />}
                  onClick={() => router.push(`/users/${u.id}`)}
                >
                  {t("openProfile")}
                </Button>
              </div>
              {selected && selected.status !== "pending" && (
                <button
                  type="button"
                  onClick={() => void undoDecision(selected)}
                  disabled={busy}
                  className="mt-3 inline-flex items-center gap-1 text-12 font-medium text-ink-2 hover:underline"
                >
                  <Undo2 className="size-3.5" aria-hidden />{" "}
                  {t("undoDecision", { document: docLabel(selected) })}
                </button>
              )}
            </div>
          ) : (
            selected && (
              <div className="rounded-xl border border-brand/30 bg-surface p-4">
                <h2 className="text-15 font-semibold text-ink">{t("decisionTitle")}</h2>
                {selected.status === "pending" ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        icon={<X />}
                        disabled={!canDecide}
                        onClick={() => setRejectOpen(true)}
                        title={t("rejectShortcut")}
                      >
                        {t("reject")}
                      </Button>
                      <Button
                        icon={<Check />}
                        loading={busy}
                        disabled={!canDecide}
                        onClick={() => void decide(selected, "approve")}
                        title={t("approveShortcut")}
                      >
                        {t("approve")}
                      </Button>
                    </div>
                    <p className="mt-2 text-12 text-muted">{t("decisionHint", { total })}</p>
                    <p className="mt-2 text-11 text-faint">{t("shortcuts")}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 flex items-center gap-2 text-13 text-ink">
                      <StatusBadge domain="document" status={selected.status} />
                      {selected.reviewedAt &&
                        t("decidedBy", {
                          date: formatDate(selected.reviewedAt, locale),
                          name: selected.reviewedBy?.fullName ?? "—",
                        })}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Undo2 />}
                      className="mt-3"
                      loading={busy}
                      onClick={() => void undoDecision(selected)}
                    >
                      {t("undo")}
                    </Button>
                  </>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {selected && (
        <RejectDocumentDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          documentLabel={docLabel(selected)}
          userName={u.fullName}
          businessName={u.businessName}
          onReject={(body) => decide(selected, "reject", body)}
        />
      )}
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        userId={u.id}
        userName={u.fullName}
        defaultType={selectedSlot?.type}
        onUploaded={refresh}
      />
    </>
  );
}

function DocIcon({ status }: { status: ReviewDocument["status"] | "missing" }) {
  const cls =
    status === "approved"
      ? "bg-green-soft text-green"
      : status === "rejected"
        ? "bg-red-soft text-red"
        : status === "missing"
          ? "bg-gray-soft text-muted"
          : "bg-brand-soft text-brand";
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4", cls)}>
      {status === "approved" ? (
        <Check aria-hidden />
      ) : status === "rejected" ? (
        <X aria-hidden />
      ) : (
        <FileText aria-hidden />
      )}
    </span>
  );
}

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  return bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DocumentViewer({ doc, label }: { doc: ReviewDocument; label: string }) {
  const t = useTranslations("verifications.review");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const isPdf = doc.mimeType === "application/pdf" || /\.pdf$/i.test(doc.fileName ?? "");
  const isImage = !isPdf && (doc.mimeType?.startsWith("image/") ?? false);

  return (
    <Card className="flex min-h-[560px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-13 text-ink">
          <span className="font-medium">{label}</span>
          {doc.fileName && <> · {doc.fileName}</>}
          {formatSize(doc.sizeBytes) && <span className="text-muted"> · {formatSize(doc.sizeBytes)}</span>}
        </span>
        {isImage && (
          <div className="flex items-center gap-1">
            <IconButton
              label={t("zoomOut")}
              size="sm"
              variant="outline"
              disabled={zoom <= 50}
              onClick={() => setZoom((z) => z - 25)}
            >
              <Minus />
            </IconButton>
            <span className="w-12 text-center text-12 text-ink-2 tabular-nums" aria-live="polite">
              {zoom}%
            </span>
            <IconButton
              label={t("zoomIn")}
              size="sm"
              variant="outline"
              disabled={zoom >= 300}
              onClick={() => setZoom((z) => z + 25)}
            >
              <Plus />
            </IconButton>
            <IconButton
              label={t("rotate")}
              size="sm"
              variant="outline"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw />
            </IconButton>
          </div>
        )}
        {doc.viewUrl && (
          <a
            href={doc.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-13 font-medium text-brand hover:bg-brand-soft"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("openFile")}
          </a>
        )}
      </div>
      <div className="flex flex-1 items-start justify-center overflow-auto bg-gray-soft p-4">
        {!doc.viewUrl ? (
          <EmptyState icon={<FileText />} title={t("noPreview")} description={t("noPreviewHint")} />
        ) : isPdf ? (
          <PdfFrame url={doc.viewUrl} label={label} />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.viewUrl}
            alt={label}
            style={{ width: `${zoom}%`, transform: `rotate(${rotation}deg)` }}
            className="max-w-none origin-center rounded-md bg-surface shadow-overlay transition-transform"
          />
        ) : (
          <EmptyState icon={<FileText />} title={t("noPreview")} description={t("noPreviewHint")} />
        )}
      </div>
    </Card>
  );
}

function CheckAgainstAccount({ detail }: { detail: VerificationDetail }) {
  const t = useTranslations("verifications.review");
  const tf = useTranslations("users.form");
  const locale = useLocale();
  const u = detail.account;
  const rows = [
    { label: t("check.name"), value: u.fullName },
    { label: t("check.business"), value: u.businessName },
    { label: t("check.wilaya"), value: u.wilaya ? localName(u.wilaya, locale) : null },
    { label: tf("category"), value: u.category ? localName(u.category, locale) : null },
    { label: tf("email"), value: u.email },
    { label: tf("phone"), value: u.phone ? formatDzPhone(u.phone) : null },
    { label: t("check.memberSince"), value: formatDate(u.createdAt, locale) },
  ].filter((r) => r.value);
  return (
    <Card>
      <CardHeader title={t("checkTitle")} subtitle={t("checkHint")} />
      <ul className="flex flex-col gap-2.5 px-[18px] py-3">
        {rows.map((r) => (
          <li key={r.label} className="flex gap-2.5">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
            <span className="min-w-0 leading-tight">
              <span className="block text-13 font-medium text-ink">{r.label}</span>
              <span className="block truncate text-12 text-muted" dir="auto">
                {r.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-[18px] py-2.5">
        <Link href={`/users/${u.id}?edit=1`} className="text-12 font-medium text-brand hover:underline">
          {t("fixAccount")}
        </Link>
      </div>
    </Card>
  );
}

function PreviousDecision({ slot }: { slot: DocumentSlot }) {
  const t = useTranslations("verifications.review");
  const tr = useTranslations("verifications.reject.reasons");
  const locale = useLocale();
  const prev = slot.previous.find((v) => v.status !== "pending" && v.reviewedAt);
  if (!prev) return null;
  return (
    <Card className="p-4">
      <h2 className="text-15 font-semibold text-ink">{t("previousTitle")}</h2>
      <p className="mt-1.5 text-13 text-ink-2">
        {t(prev.status === "rejected" ? "previousRejected" : "previousApproved", {
          date: formatDate(prev.reviewedAt!, locale),
          name: prev.reviewedBy?.fullName ?? "—",
        })}
        {prev.rejectReason && <> · {tr(prev.rejectReason)}</>}
        {prev.rejectNote && <>: “{prev.rejectNote}”</>}
      </p>
    </Card>
  );
}
