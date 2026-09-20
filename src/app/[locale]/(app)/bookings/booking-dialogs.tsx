"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  CheckCheck,
  Download,
  MessageCircle,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { FormDrawer } from "@/components/feedback/form-dialog";
import { CardSkeleton, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PriceSummary } from "@/components/domain/price-summary";
import { InvoiceDocument } from "@/components/domain/invoice-document";
import { LineItemsEditor, type LineItem } from "@/components/forms/editors";
import { Checkbox, Field, Select, TextInput, Textarea } from "@/components/forms/fields";
import { NumberInput, TimeSelect } from "@/components/forms/inputs";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cancelReschedule,
  changeBookingPrice,
  changeBookingStatus,
  downloadInvoicePdf,
  getInvoice,
  bookingKeys,
  LINE_KINDS,
  priceTotals,
  remindProvider,
  RESCHEDULE_REASONS,
  rescheduleBooking,
  STATUS_REASONS,
  sendInvoice,
  updateBooking,
  type AllowedTransition,
  type BookingDetail,
  type BookingLineKind,
  type BookingStatus,
  type PartyRole,
  type Reschedule,
  type StatusAction,
} from "@/lib/api/bookings";
import { EVENT_TYPES } from "@/lib/api/packs";
import { ApiError } from "@/lib/api/errors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils/format";
import { useCatalog } from "../services/use-service-options";
import { AvailabilityPicker, BUSY_STATUSES } from "./availability-picker";

type T = ReturnType<typeof useTranslations>;

/* ------------------------------------------------------------------ status cell */

export function BookingStatusCell({
  b,
}: {
  b: { status: BookingStatus; disputeStatus: string; noReply: boolean };
}) {
  const t = useTranslations("bookings");
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge domain="booking" status={b.status} />
      {b.disputeStatus === "open" && <Pill tone="red">{t("disputeOpen")}</Pill>}
      {b.noReply && <span className="text-11 font-medium text-red">{t("noReplyShort")}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ BKG-04 change status */

export interface StatusTarget {
  id: string;
  reference: string;
  clientName: string;
  status: BookingStatus;
}

const actionTone: Record<StatusAction, "default" | "danger" | "success" | "warning"> = {
  accepted: "success",
  declined: "danger",
  cancelled: "danger",
  completed: "default",
  reopen: "warning",
};
const actionIcon: Record<StatusAction, React.ReactNode> = {
  accepted: <Check />,
  declined: <X />,
  cancelled: <XCircle />,
  completed: <CheckCheck />,
  reopen: <RotateCcw />,
};
export const actionTarget = (a: StatusAction): BookingStatus => (a === "reopen" ? "accepted" : a);

/** Reason is required for every move except accept; the note is always required (API rules). */
export function StatusDialog({
  bookings,
  action,
  transition,
  onOpenChange,
  onDone,
}: {
  bookings: StatusTarget[];
  action: StatusAction | null;
  transition?: AllowedTransition | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("bookings.status");
  const tb = useTranslations("bookings");
  const open = !!action && bookings.length > 0;
  const [cancelledBy, setCancelledBy] = useState<PartyRole>("admin");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCancelledBy("admin");
  }
  if (!action) return null;
  const single = bookings.length === 1 ? bookings[0] : null;
  const reasonRequired = transition ? transition.reasonRequired : action !== "accepted";
  const reasons = STATUS_REASONS[action].map((r) => ({ value: r, label: t(`reasons.${r}`) }));
  const from = single?.status;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone={actionTone[action]}
      icon={actionIcon[action]}
      title={
        single
          ? t(`titles.${action}`, { reference: single.reference })
          : t(`bulkTitles.${action}`, { count: bookings.length })
      }
      description={t(`descriptions.${action}`, { client: single?.clientName ?? "" })}
      impact={
        bookings.length > 1 ? bookings.slice(0, 6).map((b) => `#${b.reference} · ${b.clientName}`) : undefined
      }
      impactTitle={t("selected", { count: bookings.length })}
      reasonField={{ options: reasons, required: reasonRequired, label: t("reason") }}
      messageField={{ label: t("note"), required: true, placeholder: t("notePlaceholder") }}
      checkboxes={[{ name: "notify", label: t("notify"), defaultChecked: true }]}
      footerNote={
        from ? `${tb(`statuses.${from}`)} → ${tb(`statuses.${actionTarget(action)}`)}` : t("savedInLog")
      }
      confirmLabel={t(`confirm.${action}`)}
      onConfirm={async (values) => {
        const failed: string[] = [];
        let lastError: unknown = null;
        for (const b of bookings) {
          try {
            await changeBookingStatus(b.id, {
              status: action,
              reason: values.reason || undefined,
              note: values.message.trim(),
              notify: values.checkboxes.notify ?? false,
              ...(action === "cancelled" ? { cancelledBy } : {}),
            });
          } catch (e) {
            if (bookings.length === 1) throw e;
            failed.push(b.reference);
            lastError = e;
          }
        }
        const done = bookings.length - failed.length;
        if (done > 0) {
          toast.success(
            single ? t(`toasts.${action}`, { reference: single.reference }) : t("bulkDone", { count: done }),
          );
        }
        onDone();
        if (failed.length > 0) {
          toast.error(t("bulkFailed", { count: failed.length, references: failed.join(", ") }), {
            description: lastError instanceof ApiError ? lastError.message : undefined,
          });
        }
      }}
    >
      {transition?.warning && <Banner tone="amber" title={t(`warnings.${transition.warning}`)} />}
      {action === "cancelled" && (
        <Field label={t("cancelledBy")}>
          <Select
            value={cancelledBy}
            onChange={(e) => setCancelledBy(e.target.value as PartyRole)}
            options={(["client", "provider", "admin"] as const).map((r) => ({
              value: r,
              label: t(`parties.${r}`),
            }))}
          />
        </Field>
      )}
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ remind */

export async function remindProviders(
  bookings: { id: string; reference: string }[],
  t: T,
  onDone?: () => void,
) {
  let sent = 0;
  let tooSoon = 0;
  let failed = 0;
  let nextAt: string | null = null;
  for (const b of bookings) {
    try {
      await remindProvider(b.id);
      sent++;
    } catch (e) {
      if (e instanceof ApiError && e.code === "REMINDER_TOO_SOON") {
        tooSoon++;
        const d = e.details as { nextReminderAt?: string; retryAfterSeconds?: number } | null;
        nextAt =
          d?.nextReminderAt ??
          (d?.retryAfterSeconds ? new Date(Date.now() + d.retryAfterSeconds * 1000).toISOString() : nextAt);
      } else if (bookings.length === 1) {
        toast.apiError(e);
        return;
      } else failed++;
    }
  }
  if (bookings.length === 1) {
    if (sent) toast.success(t("remind.sent", { reference: bookings[0].reference }));
    else
      toast.info(t("remind.tooSoon"), {
        description: nextAt ? t("remind.nextAt", { date: nextAt.slice(11, 16) }) : undefined,
      });
  } else {
    toast.success(t("remind.bulk", { sent, tooSoon, failed }));
  }
  onDone?.();
}

/* ------------------------------------------------------------------ BKG-05 reschedule */

export interface RescheduleTarget {
  id: string;
  reference: string;
  status: BookingStatus;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  provider: { id: string; fullName: string; businessName: string | null };
  pendingReschedule?: Reschedule | null;
}

export function RescheduleDialog({
  booking,
  open,
  onOpenChange,
  onDone,
}: {
  booking: RescheduleTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (b: BookingDetail) => void;
}) {
  const t = useTranslations("bookings.reschedule");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && booking) {
      setDate("");
      setBusy(false);
      setStart(booking.startTime?.slice(0, 5) ?? "");
      setEnd(booking.endTime?.slice(0, 5) ?? "");
      setReason("");
      setForce(false);
      setConflict(false);
      setSubmitted(false);
      setError(null);
    }
  }

  const submit = useMutation({
    mutationFn: () =>
      rescheduleBooking(booking!.id, {
        date,
        startTime: start || null,
        endTime: end || null,
        reason,
        force: force || undefined,
      }),
    onSuccess: (detail) => {
      toast.success(
        detail.pendingReschedule
          ? t("proposed", { reference: booking!.reference })
          : t("applied", { reference: booking!.reference }),
      );
      onDone(detail);
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "DATE_UNAVAILABLE") {
        setConflict(true);
        setError(null);
      } else setError(e instanceof Error ? e.message : String(e));
    },
  });
  const cancelProposal = useMutation({
    mutationFn: (rid: string) => cancelReschedule(booking!.id, rid),
    onSuccess: (detail) => {
      toast.success(t("proposalCancelled"));
      onDone(detail);
    },
    onError: (e) => toast.apiError(e),
  });

  if (!booking) return null;
  const pending = booking.pendingReschedule?.status === "pending" ? booking.pendingReschedule : null;
  const needsForce = busy || conflict;
  const dateLabel = (d: string) => formatDate(`${d}T12:00:00`, locale);
  const providerName = booking.provider.businessName ?? booking.provider.fullName;

  function confirm() {
    setSubmitted(true);
    if (!date || !reason || (needsForce && !force) || pending) return;
    submit.mutate();
  }

  const confirmLabel = booking.status === "accepted" && !force ? t("propose") : t("apply");

  return (
    <DialogRoot open={open} onOpenChange={(o) => !submit.isPending && onOpenChange(o)}>
      <DialogContent
        width={600}
        icon={<CalendarDays />}
        title={t("title", { reference: booking.reference })}
        description={t("current", {
          date: dateLabel(booking.eventDate),
          time:
            booking.startTime && booking.endTime
              ? `${booking.startTime.slice(0, 5)}–${booking.endTime.slice(0, 5)}`
              : "",
        })}
        footer={
          <>
            <span className="me-auto text-12 text-muted">
              {booking.status === "accepted" && !force ? t("bothMustAccept") : t("appliesNow")}
            </span>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
              {tc("cancel")}
            </Button>
            <Button icon={<CalendarDays />} loading={submit.isPending} disabled={!!pending} onClick={confirm}>
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="red" title={error} />}
          {pending && (
            <Banner
              tone="amber"
              title={t("pendingTitle", { date: dateLabel(pending.newDate) })}
              description={t("pendingDescription", {
                name: pending.proposedBy.fullName,
                date: formatDateTime(pending.createdAt, locale),
              })}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  loading={cancelProposal.isPending}
                  onClick={() => cancelProposal.mutate(pending.id)}
                >
                  {t("cancelProposal")}
                </Button>
              }
            />
          )}
          <AvailabilityPicker
            providerId={booking.provider.id}
            providerName={providerName}
            value={date}
            current={booking.eventDate}
            onChange={(d, status) => {
              setDate(d);
              setBusy(BUSY_STATUSES.includes(status));
              setConflict(false);
              setForce(false);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("newDate")} required error={submitted && !date ? tc("required") : undefined}>
              <TextInput readOnly value={date ? dateLabel(date) : ""} placeholder={t("pickDay")} />
            </Field>
            <Field label={t("start")}>
              <TimeSelect value={start} onValueChange={setStart} />
            </Field>
            <Field label={t("end")}>
              <TimeSelect value={end} onValueChange={setEnd} />
            </Field>
          </div>
          {date && !needsForce && (
            <Banner
              tone="green"
              icon={<Check />}
              title={t("free", { date: dateLabel(date), provider: providerName })}
            />
          )}
          {date && needsForce && (
            <div className="flex flex-col gap-2 rounded-lg bg-amber-soft px-4 py-3">
              <p className="text-13 font-medium text-amber">
                {conflict ? t("conflict") : t("busy", { date: dateLabel(date), provider: providerName })}
              </p>
              <Checkbox
                label={t("bookAnyway")}
                description={t("bookAnywayHint")}
                checked={force}
                onCheckedChange={setForce}
              />
              {submitted && !force && (
                <p className="text-12 text-red" role="alert">
                  {t("forceRequired")}
                </p>
              )}
            </div>
          )}
          {!needsForce && booking.status === "accepted" && (
            <Checkbox
              label={t("applyDirectly")}
              description={t("applyDirectlyHint")}
              checked={force}
              onCheckedChange={setForce}
            />
          )}
          <Field label={t("reason")} required error={submitted && !reason ? tc("required") : undefined}>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tc("select")}
              options={RESCHEDULE_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
            />
          </Field>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/* ------------------------------------------------------------------ BKG-06 adjust price */

const priceSchema = z.object({
  lines: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      amount: z.number().nullable(),
      kind: z.string().optional(),
      quantity: z.number().nullable().optional(),
    }),
  ),
  reason: z.string().trim().min(1, "required"),
});

export function toEditorLines(b: Pick<BookingDetail, "lines">): LineItem[] {
  return b.lines.map((l) => ({
    id: l.id,
    kind: l.kind,
    label: l.label,
    quantity: l.quantity,
    amount: Math.abs(Number(l.unitAmount)),
  }));
}

export function PriceDrawer({
  booking,
  open,
  onOpenChange,
  onDone,
}: {
  booking: BookingDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (b: BookingDetail) => void;
}) {
  const t = useTranslations("bookings.price");
  const tk = useTranslations("bookings.lineKinds");
  const tc = useTranslations("common");
  const locale = useLocale();
  if (!booking) return null;
  const title = locale === "ar" ? booking.offer.titleAr || booking.offer.titleEn : booking.offer.titleEn;
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      width={680}
      title={t("title")}
      description={`#${booking.reference} · ${title}`}
      schema={priceSchema}
      defaultValues={{ lines: toEditorLines(booking), reason: "" }}
      submitLabel={t("save")}
      footerNote={booking.status === "accepted" ? t("invoiceRegenerated") : t("clientNotified")}
      onSubmit={async (values) => {
        const invalid = values.lines.some((l) => !l.label.trim() || l.amount === null || !l.quantity);
        if (values.lines.length === 0 || invalid) throw new Error(t("linesInvalid"));
        const totals = priceTotals(
          values.lines.map((l) => ({
            kind: (l.kind ?? "adjustment") as BookingLineKind,
            quantity: l.quantity ?? 1,
            unitAmount: l.amount ?? 0,
          })),
          booking.feePercent,
        );
        if (totals.negative) throw new Error(t("negative"));
        const detail = await changeBookingPrice(booking.id, {
          reason: values.reason,
          lines: values.lines.map((l) => {
            const original = booking.lines.find((o) => o.id === l.id);
            return {
              kind: (l.kind ?? "adjustment") as BookingLineKind,
              label: l.label.trim(),
              quantity: l.quantity ?? 1,
              unitAmount: (l.amount ?? 0).toFixed(2),
              ...(original?.serviceId ? { serviceId: original.serviceId } : {}),
            };
          }),
        });
        toast.success(t("saved", { reference: booking.reference, total: formatMoney(detail.total, locale) }));
        onDone(detail);
      }}
      fields={(form) => (
        <>
          <Controller
            control={form.control}
            name="lines"
            render={({ field }) => {
              const lines = field.value as LineItem[];
              const totals = priceTotals(
                lines.map((l) => ({
                  kind: (l.kind ?? "adjustment") as BookingLineKind,
                  quantity: l.quantity ?? 0,
                  unitAmount: l.amount ?? 0,
                })),
                booking.feePercent,
              );
              return (
                <div className="flex flex-col gap-3">
                  <LineItemsEditor
                    value={lines}
                    onChange={field.onChange}
                    kindOptions={LINE_KINDS.map((k) => ({ value: k, label: tk(k) }))}
                    showQuantity
                    newLine={{ kind: "adjustment", quantity: 1 }}
                    hideSummary
                    addLabel={t("addLine")}
                    labelPlaceholder={t("linePlaceholder")}
                  />
                  <div className="overflow-hidden rounded-lg bg-canvas" data-testid="price-totals">
                    <PriceSummary
                      before={booking.total}
                      total={totals.total}
                      feePercent={booking.feePercent}
                      feeAmount={totals.feeAmount}
                      providerAmount={totals.providerAmount}
                    />
                  </div>
                  {totals.negative && (
                    <p className="text-12 text-red" role="alert">
                      {t("negative")}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Controller
            control={form.control}
            name="reason"
            render={({ field, fieldState }) => (
              <Field label={t("reason")} required error={fieldState.error ? tc("required") : undefined}>
                <Textarea {...field} rows={3} maxLength={255} placeholder={t("reasonPlaceholder")} />
              </Field>
            )}
          />
        </>
      )}
    />
  );
}

/* ------------------------------------------------------------------ event details drawer */

const detailsSchema = z.object({
  eventType: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  wilayaCode: z.string(),
  locationText: z.string().max(255),
  guests: z.number().int().min(1).nullable(),
  clientNote: z.string().max(2000),
});

export function EventDetailsDrawer({
  booking,
  open,
  onOpenChange,
  onDone,
}: {
  booking: BookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (b: BookingDetail) => void;
}) {
  const t = useTranslations("bookings.details");
  const tp = useTranslations("packs");
  const catalog = useCatalog();
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("editTitle")}
      description={`#${booking.reference}`}
      schema={detailsSchema}
      defaultValues={{
        eventType: booking.eventType,
        startTime: booking.startTime?.slice(0, 5) ?? "",
        endTime: booking.endTime?.slice(0, 5) ?? "",
        wilayaCode: String(booking.wilaya.code),
        locationText: booking.locationText ?? "",
        guests: booking.guests,
        clientNote: booking.clientNote ?? "",
      }}
      footerNote={t("dateHint")}
      onSubmit={async (v) => {
        const detail = await updateBooking(booking.id, {
          eventType: v.eventType as BookingDetail["eventType"],
          startTime: v.startTime || null,
          endTime: v.endTime || null,
          wilayaCode: Number(v.wilayaCode),
          ...(Number(v.wilayaCode) !== booking.wilaya.code ? { communeId: null } : {}),
          locationText: v.locationText.trim() || null,
          guests: v.guests,
          clientNote: v.clientNote.trim() || null,
        });
        toast.success(t("saved"));
        onDone(detail);
      }}
      fields={(form) => (
        <>
          <Controller
            control={form.control}
            name="eventType"
            render={({ field }) => (
              <Field label={t("eventType")}>
                <Select
                  {...field}
                  options={EVENT_TYPES.map((e) => ({ value: e, label: tp(`eventTypes.${e}`) }))}
                />
              </Field>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <Field label={t("start")}>
                  <TimeSelect value={field.value} onValueChange={field.onChange} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <Field label={t("end")}>
                  <TimeSelect value={field.value} onValueChange={field.onChange} />
                </Field>
              )}
            />
          </div>
          <Controller
            control={form.control}
            name="wilayaCode"
            render={({ field }) => (
              <Field label={t("wilaya")}>
                <Select {...field} options={catalog.wilayaOptions} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="locationText"
            render={({ field }) => (
              <Field label={t("location")}>
                <TextInput {...field} maxLength={255} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="guests"
            render={({ field, fieldState }) => (
              <Field label={t("guests")} error={fieldState.error?.message}>
                <NumberInput value={field.value ?? null} onValueChange={field.onChange} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="clientNote"
            render={({ field }) => (
              <Field label={t("clientNote")}>
                <Textarea {...field} rows={3} maxLength={2000} />
              </Field>
            )}
          />
        </>
      )}
    />
  );
}

/* ------------------------------------------------------------------ BKG-07 invoice */

export function InvoiceModal({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("bookings.invoice");
  const tc = useTranslations("common");
  const locale = useLocale();
  const query = useQuery({
    queryKey: bookingKeys.invoice(bookingId),
    queryFn: () => getInvoice(bookingId),
    enabled: open,
    retry: false,
  });
  const send = useMutation({
    mutationFn: () => sendInvoice(bookingId),
    onSuccess: (inv) => {
      toast.success(t("sent", { number: inv.number }));
      void query.refetch();
    },
    onError: (e) => toast.apiError(e),
  });
  const download = useMutation({
    mutationFn: () => downloadInvoicePdf(bookingId, `${query.data?.number ?? "invoice"}.pdf`),
    onError: (e) => toast.apiError(e),
  });
  const notIssued = query.error instanceof ApiError && query.error.code === "INVOICE_NOT_FOUND";
  const inv = query.data;

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width={640}
        title={inv ? t("title", { number: inv.number }) : t("titleShort")}
        description={
          inv?.sentToClientAt ? t("sentAt", { date: formatDateTime(inv.sentToClientAt, locale) }) : undefined
        }
        footer={
          <>
            {inv && inv.versions.length > 1 && (
              <span className="me-auto text-12 text-muted">
                {t("versions", { count: inv.versions.length })}
              </span>
            )}
            {!(inv && inv.versions.length > 1) && <span className="me-auto" />}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("close")}
            </Button>
            <Button
              variant="secondary"
              icon={<MessageCircle />}
              disabled={!inv}
              loading={send.isPending}
              onClick={() => send.mutate()}
            >
              {t("send")}
            </Button>
            <Button
              icon={<Download />}
              disabled={!inv}
              loading={download.isPending}
              onClick={() => download.mutate()}
            >
              {t("download")}
            </Button>
          </>
        }
      >
        <div>
          {query.isPending && open ? (
            <CardSkeleton className="h-[320px]" />
          ) : notIssued ? (
            <Banner tone="blue" title={t("notIssuedTitle")} description={t("notIssuedDescription")} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : inv ? (
            <InvoiceDocument invoice={inv} />
          ) : null}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
