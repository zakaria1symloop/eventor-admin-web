"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  EyeOff,
  Eye,
  Layers,
  MoreHorizontal,
  Pencil,
  Scale,
  Star,
  Trash2,
  TriangleAlert,
  User,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DialogRoot, DrawerContent } from "@/components/feedback/dialog";
import { ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Checkbox, Field, RadioCards, Textarea } from "@/components/forms/fields";
import { ActionMenu } from "@/components/ui/action-menu";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  deleteReply,
  firstOpenReport,
  flagSegments,
  getReview,
  hideReply,
  maskContacts,
  moderateReview,
  reportKeys,
  reviewKeys,
  showReply,
  type ModerationAction,
  type ReviewDetail,
  type ReviewReport,
} from "@/lib/api/reviews";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDateTime, initials } from "@/lib/utils/format";
import {
  ConvertReportDialog,
  DeleteReviewDialog,
  EditReviewDialog,
  ReportDecisionDialog,
} from "./review-dialogs";

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("size-3.5", i <= Math.round(rating) ? "fill-gold text-gold" : "text-gold")}
        />
      ))}
    </span>
  );
}

/** Comment with detected contact details highlighted (REV-02). */
export function FlaggedText({ text }: { text: string }) {
  const t = useTranslations("reviews.flags");
  return (
    <>
      {flagSegments(text).map((s, i) =>
        s.flag ? (
          <mark key={i} title={t(s.flag)} className="rounded-[3px] bg-amber-soft px-0.5 text-amber">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function LinkRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-2.5 text-13 hover:bg-canvas [&>svg:first-child]:size-4 [&>svg:first-child]:text-ink-2"
    >
      {icon}
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-brand">{value}</span>
      <ChevronRight aria-hidden className="flip-rtl size-4 text-faint" />
    </Link>
  );
}

type Decision = ModerationAction | "";

/** Decisions offered for the current status (same rules as `allowedActions`). */
export function decisionOptions(review: Pick<ReviewDetail, "allowedActions" | "status">): ModerationAction[] {
  const order: ModerationAction[] = ["redact", "hide", "dismiss_reports", "show"];
  return order.filter((a) => review.allowedActions.includes(a));
}

/** REV-02 — review moderation drawer (`/reviews?review=<id>`). */
export function ReviewDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("reviews.drawer");
  const tr = useTranslations("reviews");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const review = useQuery({
    queryKey: reviewKeys.detail(id ?? ""),
    queryFn: () => getReview(id!),
    enabled: !!id,
  });
  const r = review.data;

  const [decision, setDecision] = useState<Decision>("");
  const [redacted, setRedacted] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [reportAction, setReportAction] = useState<{ id: string; mode: "resolve" | "dismiss" } | null>(null);
  const [deletingReply, setDeletingReply] = useState(false);

  // Reset the form whenever another review (or a new version of it) loads.
  const formKey = r ? `${r.id}:${r.updatedAt}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  if (formKey !== loadedKey) {
    setLoadedKey(formKey);
    if (r) {
      const opts = decisionOptions(r);
      const contact = r.detectedFlags.some((f) => f !== "insult");
      setDecision(contact && opts.includes("redact") && r.status !== "redacted" ? "redact" : "");
      setRedacted(r.redactedComment ?? maskContacts(r.comment, tr("mask")));
      setNote("");
      setNotify(true);
      setSubmitted(false);
      setError(null);
    }
  }

  const mask = tr("mask");
  const setDetail = (d: ReviewDetail) => {
    queryClient.setQueryData(reviewKeys.detail(d.id), d);
    void queryClient.invalidateQueries({ queryKey: [...reviewKeys.all, "list"] });
    void queryClient.invalidateQueries({ queryKey: [...reviewKeys.all, "stats"] });
    void queryClient.invalidateQueries({ queryKey: reportKeys.all });
  };
  const redactMissing = decision === "redact" && !redacted.trim();

  async function apply() {
    if (!r) return;
    setSubmitted(true);
    if (!decision || redactMissing) return;
    setPending(true);
    setError(null);
    try {
      const updated = await moderateReview(r.id, {
        action: decision,
        redactedComment: decision === "redact" ? redacted.trim() : undefined,
        note: note.trim() || undefined,
        notifyAuthor: decision === "dismiss_reports" ? undefined : notify,
      });
      setDetail(updated);
      const undo =
        decision === "hide" && r.status === "published"
          ? () =>
              void moderateReview(r.id, { action: "show", notifyAuthor: false }).then(
                setDetail,
                toast.apiError,
              )
          : decision === "show" && r.status === "hidden"
            ? () =>
                void moderateReview(r.id, { action: "hide", notifyAuthor: false }).then(
                  setDetail,
                  toast.apiError,
                )
            : undefined;
      toast.success(t(`done.${decision}`), {
        action: undo ? { label: tc("undo"), onClick: undo } : undefined,
      });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  async function replyAction(kind: "hide" | "show") {
    if (!r?.reply) return;
    try {
      const updated = await (kind === "hide" ? hideReply(r.reply.id) : showReply(r.reply.id));
      setDetail(updated);
      toast.success(t(`reply.${kind}Done`), {
        action: {
          label: tc("undo"),
          onClick: () =>
            void (kind === "hide" ? showReply(r.reply!.id) : hideReply(r.reply!.id)).then(
              setDetail,
              toast.apiError,
            ),
        },
      });
    } catch (e) {
      toast.apiError(e);
    }
  }

  const openReport = r ? firstOpenReport(r) : undefined;
  const provider = r ? (r.provider.businessName ?? r.provider.fullName) : "";
  const offerTitle = r?.service
    ? locale === "ar"
      ? r.service.titleAr || r.service.titleEn
      : r.service.titleEn || r.service.titleAr
    : r?.pack
      ? locale === "ar"
        ? r.pack.nameAr || r.pack.nameEn
        : r.pack.nameEn || r.pack.nameAr
      : "";
  const options = r ? decisionOptions(r) : [];
  const errorMessage = error instanceof ApiError || error instanceof Error ? error.message : null;
  const reporterName = (rep: ReviewReport) => rep.reporter?.fullName ?? t("automatic");

  return (
    <>
      <DialogRoot open={!!id} onOpenChange={(o) => !o && !pending && onClose()}>
        <DrawerContent
          width={500}
          title={r ? t("title", { reference: r.booking.reference }) : t("loading")}
          description={
            r
              ? openReport
                ? openReport.reporter
                  ? t("reportedBy", {
                      name: openReport.reporter.fullName,
                      date: formatDate(openReport.createdAt, locale),
                    })
                  : t("autoFlagged", { date: formatDate(openReport.createdAt, locale) })
                : t("written", { date: formatDate(r.createdAt, locale) })
              : undefined
          }
          footer={
            r && (
              <>
                <ActionMenu
                  align="start"
                  trigger={
                    <IconButton label={tc("moreActions")} variant="outline" className="me-auto">
                      <MoreHorizontal />
                    </IconButton>
                  }
                  groups={[
                    [
                      { icon: <Pencil />, label: t("menu.edit"), onSelect: () => setEditing(true) },
                      {
                        icon: <Scale />,
                        label: t("menu.convert"),
                        disabled: !r.allowedActions.includes("convert_report") || !openReport,
                        onSelect: () => openReport && setConverting(openReport.id),
                      },
                    ],
                    [
                      {
                        icon: <Trash2 />,
                        label: t("menu.delete"),
                        danger: true,
                        onSelect: () => setDeleting(true),
                      },
                    ],
                  ]}
                />
                <Button variant="secondary" onClick={onClose} disabled={pending}>
                  {tc("cancel")}
                </Button>
                {options.length > 0 && (
                  <Button icon={<Check />} loading={pending} onClick={() => void apply()}>
                    {t("apply")}
                  </Button>
                )}
              </>
            )
          }
        >
          {review.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded-sm bg-gray-soft" />
              ))}
            </div>
          ) : review.isError ? (
            <ErrorState error={review.error} onRetry={() => void review.refetch()} />
          ) : r ? (
            <div className="flex flex-col gap-5">
              {errorMessage && <Banner tone="red" title={errorMessage} />}

              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-soft text-13 font-semibold text-blue">
                  {initials(r.author.fullName)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <Link
                    href={`/users/${r.author.id}`}
                    className="text-14 font-medium text-brand hover:underline"
                  >
                    {r.author.fullName}
                  </Link>
                  <div className="text-12 text-muted">
                    {[t("client"), r.hadDispute ? tr("hadDispute") : null, r.editedAt ? t("edited") : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ReviewStatusPill status={r.status} reportsOpen={r.reportsOpen} />
              </div>

              <figure className="rounded-lg bg-canvas px-4 py-3">
                <div className="flex items-center gap-2 text-14 font-semibold text-gold">
                  <Stars rating={r.rating} />
                  <span className="tabular-nums">{r.rating.toFixed(1)}</span>
                </div>
                <blockquote className="mt-1.5 text-15 whitespace-pre-wrap text-ink">
                  “<FlaggedText text={r.comment} />”
                </blockquote>
                {r.status === "redacted" && r.redactedComment && (
                  <figcaption className="mt-2 border-t border-border pt-2 text-12 text-muted">
                    <span className="font-medium text-ink-2">{t("publicText")}</span> {r.redactedComment}
                  </figcaption>
                )}
              </figure>

              {r.detectedFlags.length > 0 && (
                <Banner
                  tone="amber"
                  icon={<Bell />}
                  title={t("detected", {
                    flags: r.detectedFlags.map((f) => tr(`flags.${f}`)).join(" · "),
                  })}
                />
              )}

              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {r.service && (
                  <LinkRow
                    icon={<Briefcase />}
                    label={t("service")}
                    value={offerTitle}
                    href={`/services/${r.service.id}`}
                  />
                )}
                {r.pack && (
                  <LinkRow
                    icon={<Layers />}
                    label={t("pack")}
                    value={offerTitle}
                    href={`/packs/${r.pack.id}`}
                  />
                )}
                <LinkRow
                  icon={<User />}
                  label={t("provider")}
                  value={
                    r.provider.businessName
                      ? `${r.provider.businessName} (${r.provider.fullName})`
                      : r.provider.fullName
                  }
                  href={`/users/${r.provider.id}`}
                />
                <LinkRow
                  icon={<CalendarDays />}
                  label={t("booking")}
                  value={`#${r.booking.reference} · ${tr(`bookingStatus.${r.booking.status}`)} ${formatDate(r.booking.eventDate, locale)}`}
                  href={`/bookings/${r.booking.id}`}
                />
                {r.disputes.map((d) => (
                  <LinkRow
                    key={d.id}
                    icon={<TriangleAlert />}
                    label={t("dispute")}
                    value={`${d.reference} · ${tr(`disputeStatus.${d.status}`)}`}
                    href={`/disputes/${d.id}`}
                  />
                ))}
              </div>

              {r.moderatedBy && r.moderatedAt && (
                <p className="text-12 text-muted">
                  {t("moderated", {
                    name: r.moderatedBy.fullName,
                    date: formatDateTime(r.moderatedAt, locale),
                  })}
                  {r.moderationNote ? ` · “${r.moderationNote}”` : ""}
                </p>
              )}

              {r.reply && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-14 font-semibold text-ink">
                    {t("reply.title", { name: provider })}
                    <StatusBadge
                      domain="review"
                      status={r.reply.status}
                      label={tr(`replyStatus.${r.reply.status}`)}
                    />
                    {r.reply.reportsOpen > 0 && (
                      <Pill tone="red">{tr("reportsOpen", { count: r.reply.reportsOpen })}</Pill>
                    )}
                  </h3>
                  <div
                    className={cn(
                      "rounded-lg border border-border px-3.5 py-2.5 text-13 whitespace-pre-wrap",
                      r.reply.status === "hidden" ? "text-muted" : "text-ink",
                    )}
                  >
                    <FlaggedText text={r.reply.body} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.reply.status === "published" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<EyeOff />}
                        onClick={() => void replyAction("hide")}
                      >
                        {t("reply.hide")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Eye />}
                        onClick={() => void replyAction("show")}
                      >
                        {t("reply.show")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger-outline"
                      icon={<Trash2 />}
                      onClick={() => setDeletingReply(true)}
                    >
                      {t("reply.delete")}
                    </Button>
                  </div>
                </section>
              )}

              {r.reports.length > 0 && (
                <section>
                  <h3 className="mb-2 text-14 font-semibold text-ink">
                    {t("reports", { count: r.reports.length })}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {r.reports.map((rep) => (
                      <li key={rep.id} className="rounded-lg border border-border px-3.5 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-13">
                          <span className="font-medium text-ink">{tr(`reasons.${rep.reason}`)}</span>
                          {rep.targetType === "review_reply" && (
                            <Pill tone="gray" dot={false}>
                              {t("onReply")}
                            </Pill>
                          )}
                          <span className="ms-auto">
                            <StatusBadge domain="report" status={rep.status} />
                          </span>
                        </div>
                        <div className="mt-0.5 text-12 text-muted">
                          {reporterName(rep)} · {formatDate(rep.createdAt, locale)}
                        </div>
                        {rep.note && <p className="mt-1 text-13 text-ink-2">“{rep.note}”</p>}
                        {rep.status !== "open" && (rep.resolutionNote || rep.resolvedBy) && (
                          <p className="mt-1 text-12 text-muted">
                            {rep.resolvedBy?.fullName}
                            {rep.resolutionNote ? ` · ${rep.resolutionNote}` : ""}
                          </p>
                        )}
                        {rep.disputeId && (
                          <Link
                            href={`/disputes/${rep.disputeId}`}
                            className="mt-1 inline-block text-12 font-medium text-brand hover:underline"
                          >
                            {t("openDispute")}
                          </Link>
                        )}
                        {rep.status === "open" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<XCircle />}
                              onClick={() => setReportAction({ id: rep.id, mode: "dismiss" })}
                            >
                              {t("dismissReport")}
                            </Button>
                            {r.allowedActions.includes("convert_report") && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Scale />}
                                onClick={() => setConverting(rep.id)}
                              >
                                {t("menu.convert")}
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {options.length > 0 && (
                <section>
                  <h3 className="mb-2 text-14 font-semibold text-ink">{t("decision")}</h3>
                  <RadioCards
                    aria-label={t("decision")}
                    value={decision}
                    onValueChange={(v) => {
                      setDecision(v as Decision);
                      setSubmitted(false);
                    }}
                    options={options.map((a) => ({
                      value: a,
                      label: t(`decisions.${a}.label`),
                      description:
                        a === "redact"
                          ? t("decisions.redact.description", {
                              text: truncate(maskContacts(r.comment, mask), 60),
                            })
                          : t(`decisions.${a}.description`),
                    }))}
                  />
                  {submitted && !decision && <p className="mt-1.5 text-12 text-red">{t("pickDecision")}</p>}
                  {decision === "redact" && (
                    <Field
                      label={t("redactedText")}
                      required
                      hint={t("redactedHint")}
                      error={submitted && redactMissing ? t("redactedRequired") : undefined}
                      className="mt-4"
                    >
                      <Textarea value={redacted} rows={4} onChange={(e) => setRedacted(e.target.value)} />
                    </Field>
                  )}
                  {decision && (
                    <Field label={t("note")} className="mt-4">
                      <Textarea
                        value={note}
                        rows={2}
                        placeholder={t("notePlaceholder")}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </Field>
                  )}
                  {decision && decision !== "dismiss_reports" && (
                    <div className="mt-3">
                      <Checkbox label={t("notify")} checked={notify} onCheckedChange={setNotify} />
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : null}
        </DrawerContent>
      </DialogRoot>

      <EditReviewDialog review={r ?? null} open={editing} onOpenChange={setEditing} onSaved={setDetail} />
      <DeleteReviewDialog
        review={r ?? null}
        open={deleting}
        onOpenChange={setDeleting}
        onHideInstead={r?.allowedActions.includes("hide") ? () => setDecision("hide") : undefined}
        onDeleted={() => {
          if (r) queryClient.removeQueries({ queryKey: reviewKeys.detail(r.id) });
          onClose();
        }}
      />
      <ConvertReportDialog
        reportId={converting}
        open={!!converting}
        onOpenChange={(o) => !o && setConverting(null)}
        onDone={() => void review.refetch()}
      />
      <ReportDecisionDialog
        reportId={reportAction?.id ?? null}
        mode={reportAction?.mode ?? "dismiss"}
        open={!!reportAction}
        onOpenChange={(o) => !o && setReportAction(null)}
        onDone={() => void review.refetch()}
      />
      <ConfirmDialog
        open={deletingReply}
        onOpenChange={setDeletingReply}
        tone="danger"
        icon={<Trash2 />}
        title={t("reply.deleteTitle")}
        description={t("reply.deleteDescription")}
        confirmLabel={t("reply.delete")}
        onConfirm={async () => {
          if (!r?.reply) return;
          await deleteReply(r.reply.id);
          toast.success(t("reply.deleteDone"));
          await review.refetch();
          void queryClient.invalidateQueries({ queryKey: [...reviewKeys.all, "list"] });
        }}
      />
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Status pill: an open report wins over the status (Figma "Reported"). */
export function ReviewStatusPill({ status, reportsOpen }: { status: string; reportsOpen: number }) {
  return reportsOpen > 0 && status === "published" ? (
    <StatusBadge domain="review" status="reported" />
  ) : (
    <StatusBadge domain="review" status={status} />
  );
}
