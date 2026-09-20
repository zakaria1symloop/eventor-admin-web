"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormDialog } from "@/components/feedback/form-dialog";
import { toast } from "@/components/feedback/toast";
import { Field, Select, Textarea } from "@/components/forms/fields";
import { SegmentedControl } from "@/components/forms/inputs";
import { useRouter } from "@/i18n/navigation";
import { DISPUTE_TYPES, disputeKeys, type DisputeType } from "@/lib/api/disputes";
import { conversationKeys } from "@/lib/api/messaging";
import {
  convertReport,
  deleteReview,
  dismissReport,
  editReview,
  reportKeys,
  resolveReport,
  reviewKeys,
  type ReportResolveAction,
  type ReviewDetail,
  type ReviewRow,
} from "@/lib/api/reviews";

const RESOLVE_ACTIONS: ReportResolveAction[] = [
  "content_hidden",
  "content_redacted",
  "content_deleted",
  "chat_closed",
  "user_warned",
  "user_blocked",
  "service_hidden",
  "other",
];
const DELETE_REASONS = ["fake", "insult", "personal_data", "author_request", "off_topic", "other"] as const;

function useInvalidateModeration() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    void queryClient.invalidateQueries({ queryKey: reportKeys.all });
  };
}

type ReviewRef = Pick<ReviewRow, "id" | "rating" | "author" | "provider">;

/** REV-03 — delete a review (reason required); "Hide instead" goes back to the hide decision. */
export function DeleteReviewDialog({
  review,
  open,
  onOpenChange,
  onHideInstead,
  onDeleted,
}: {
  review: ReviewRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHideInstead?: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("reviews.delete");
  const invalidate = useInvalidateModeration();
  const provider = review ? (review.provider.businessName ?? review.provider.fullName) : "";
  return (
    <ConfirmDialog
      open={open && !!review}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Trash2 />}
      title={t("title")}
      description={
        review
          ? t("description", { author: review.author.fullName, provider, rating: review.rating.toFixed(1) })
          : ""
      }
      impact={[t("impactRating", { provider }), t("impactRewrite"), t("impactHide")]}
      reasonField={{
        label: t("reason"),
        required: true,
        options: DELETE_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })),
      }}
      messageField={{ label: t("details"), placeholder: t("detailsPlaceholder") }}
      secondaryAction={
        onHideInstead
          ? {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-4" aria-hidden />
                  {t("hideInstead")}
                </span>
              ),
              onClick: () => {
                onOpenChange(false);
                onHideInstead();
              },
            }
          : undefined
      }
      confirmLabel={t("confirm")}
      footerNote={undefined}
      onConfirm={async (v) => {
        if (!review) return;
        const label = t(`reasons.${v.reason as (typeof DELETE_REASONS)[number]}`);
        const res = await deleteReview(review.id, {
          reason: v.message.trim() ? `${label} — ${v.message.trim()}` : label,
        });
        toast.success(t("done"), {
          description: res.reportsResolved ? t("reportsResolved", { count: res.reportsResolved }) : undefined,
        });
        invalidate();
        onDeleted?.();
      }}
    />
  );
}

const editSchema = z.object({
  comment: z.string().trim().min(1, "required").max(5000),
  reason: z.string().trim().min(1, "required").max(2000),
});

/** REV-02 ⋯ Edit text — replaces the comment with a required reason (audit keeps both texts). */
export function EditReviewDialog({
  review,
  open,
  onOpenChange,
  onSaved,
}: {
  review: Pick<ReviewDetail, "id" | "comment"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (review: ReviewDetail) => void;
}) {
  const t = useTranslations("reviews.edit");
  const tc = useTranslations("common");
  const invalidate = useInvalidateModeration();
  return (
    <FormDialog
      open={open && !!review}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      schema={editSchema}
      defaultValues={{ comment: review?.comment ?? "", reason: "" }}
      submitLabel={t("submit")}
      footerNote={tc("savedInActivityLog")}
      fields={(form) => (
        <div className="flex flex-col gap-4">
          <Controller
            control={form.control}
            name="comment"
            render={({ field, fieldState }) => (
              <Field label={t("comment")} required error={fieldState.error ? tc("required") : undefined}>
                <Textarea {...field} rows={6} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="reason"
            render={({ field, fieldState }) => (
              <Field
                label={t("reason")}
                required
                hint={t("reasonHint")}
                error={fieldState.error ? tc("required") : undefined}
              >
                <Textarea {...field} rows={2} placeholder={t("reasonPlaceholder")} />
              </Field>
            )}
          />
        </div>
      )}
      onSubmit={async (values) => {
        if (!review) return;
        const updated = await editReview(review.id, values);
        toast.success(t("done"));
        invalidate();
        onSaved?.(updated);
        onOpenChange(false);
      }}
    />
  );
}

const convertSchema = z.object({
  type: z.string().min(1, "type"),
  openedByRole: z.enum(["client", "provider"]),
  description: z.string().trim().min(30, "min").max(5000),
});

/** REV-02 ⋯ Convert report to dispute (also REV reports queue and MSG-01). */
export function ConvertReportDialog({
  reportId,
  defaultRole = "client",
  open,
  onOpenChange,
  onDone,
}: {
  reportId: string | null;
  defaultRole?: "client" | "provider";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const t = useTranslations("reviews.convert");
  const td = useTranslations("disputes");
  const tc = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateModeration();
  return (
    <FormDialog
      open={open && !!reportId}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      schema={convertSchema}
      defaultValues={{ type: "", openedByRole: defaultRole, description: "" }}
      submitLabel={t("submit")}
      width={560}
      fields={(form) => (
        <div className="flex flex-col gap-4">
          <Controller
            control={form.control}
            name="openedByRole"
            render={({ field }) => (
              <Field label={t("openedFor")} required>
                <SegmentedControl
                  aria-label={t("openedFor")}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={(["client", "provider"] as const).map((r) => ({
                    value: r,
                    label: td(`roles.${r}`),
                  }))}
                />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="type"
            render={({ field, fieldState }) => (
              <Field label={t("type")} required error={fieldState.error ? t("typeRequired") : undefined}>
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={tc("select")}
                  options={DISPUTE_TYPES.map((k) => ({ value: k, label: td(`types.${k}`) }))}
                />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Field
                label={t("descriptionLabel")}
                required
                hint={t("descriptionHint")}
                error={fieldState.error ? t("descriptionMin") : undefined}
              >
                <Textarea {...field} rows={4} />
              </Field>
            )}
          />
        </div>
      )}
      onSubmit={async (values) => {
        if (!reportId) return;
        const row = await convertReport(reportId, {
          type: values.type as DisputeType,
          openedByRole: values.openedByRole,
          description: values.description,
        });
        invalidate();
        void queryClient.invalidateQueries({ queryKey: disputeKeys.all });
        void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
        onOpenChange(false);
        onDone?.();
        toast.success(t("done", { reference: row.disputeReference ?? "" }), {
          action: row.disputeId
            ? { label: t("openDispute"), onClick: () => router.push(`/disputes/${row.disputeId}`) }
            : undefined,
        });
      }}
    />
  );
}

/** Resolve (note + what was done) or dismiss (note) a report. */
export function ReportDecisionDialog({
  reportId,
  mode,
  open,
  onOpenChange,
  onDone,
}: {
  reportId: string | null;
  mode: "resolve" | "dismiss";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const t = useTranslations("reviews.reportDecision");
  const invalidate = useInvalidateModeration();
  const queryClient = useQueryClient();
  return (
    <ConfirmDialog
      open={open && !!reportId}
      onOpenChange={onOpenChange}
      icon={mode === "resolve" ? <CheckCircle2 /> : <XCircle />}
      tone={mode === "resolve" ? "success" : "default"}
      title={t(`${mode}.title`)}
      description={t(`${mode}.description`)}
      reasonField={
        mode === "resolve"
          ? {
              label: t("action"),
              options: RESOLVE_ACTIONS.map((a) => ({ value: a, label: t(`actions.${a}`) })),
            }
          : undefined
      }
      messageField={{ label: t("note"), required: true, placeholder: t(`${mode}.placeholder`) }}
      confirmLabel={t(`${mode}.confirm`)}
      onConfirm={async (v) => {
        if (!reportId) return;
        if (mode === "resolve") {
          await resolveReport(reportId, {
            note: v.message.trim(),
            action: (v.reason || undefined) as ReportResolveAction | undefined,
          });
        } else {
          await dismissReport(reportId, { note: v.message.trim() });
        }
        toast.success(t(`${mode}.done`));
        invalidate();
        void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
        onDone?.();
      }}
    />
  );
}
