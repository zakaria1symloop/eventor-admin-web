"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Pencil, X, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { Checkbox, Field, RadioCards, Textarea } from "@/components/forms/fields";
import { DateInput, NumberInput, TimeSelect } from "@/components/forms/inputs";
import { AsyncSelect, type Option } from "@/components/forms/select-inputs";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import {
  approveRequest,
  bookedProposal,
  bookProposal,
  CANCEL_REASONS,
  cancelRequest,
  changeableFields,
  REJECT_REASONS,
  rejectRequest,
  requestChanges,
  requestKeys,
  type Proposal,
  type RequestDetail,
} from "@/lib/api/academic-requests";
import { bookingKeys } from "@/lib/api/bookings";
import { listServices } from "@/lib/api/services";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";
import { localName } from "../users/use-user-options";

function useRefresh(id: string) {
  const queryClient = useQueryClient();
  return (detail: RequestDetail) => {
    queryClient.setQueryData(requestKeys.detail(id), detail);
    void queryClient.invalidateQueries({ queryKey: requestKeys.all });
  };
}

/** Published services for AsyncSelect, ranked by the request's needs and wilaya ("Fits"). */
export function useServiceSearch(request: RequestDetail) {
  const locale = useLocale();
  const t = useTranslations("academic.proposals");
  const needs = new Set(request.needs.map((n) => n.category.id));
  return async (q: string): Promise<Option[]> => {
    const res = await listServices({
      tab: "published",
      q: q || undefined,
      wilaya: request.wilaya ? [request.wilaya.code] : undefined,
      limit: 30,
    });
    const taken = new Set(request.proposals.map((p) => p.service.id));
    return res.data
      .filter((s) => !taken.has(s.id))
      .sort((a, b) => Number(needs.has(b.category.id)) - Number(needs.has(a.category.id)))
      .map((s) => ({
        value: s.id,
        label: `${locale === "ar" ? s.titleAr || s.titleEn : s.titleEn} · ${s.provider.businessName ?? s.provider.fullName}`,
        sub: [
          localName(s.category, locale),
          formatMoney(s.basePrice, locale),
          needs.has(s.category.id) ? t("fits") : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }));
  };
}

/* ------------------------------------------------------------------ ACR-03 approve */

export function ApproveDialog({
  request,
  open,
  onOpenChange,
}: {
  request: RequestDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("academic.approve");
  const refresh = useRefresh(request.id);
  const search = useServiceSearch(request);
  const [services, setServices] = useState<Option[]>([]);
  const [picker, setPicker] = useState<Option | null>(null);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setServices([]);
        onOpenChange(o);
      }}
      tone="success"
      icon={<Check />}
      title={t("title", { title: request.title })}
      description={t("description", { name: request.institutionName ?? request.requester.name })}
      messageField={{ label: t("message"), defaultValue: t("defaultMessage") }}
      confirmLabel={t("submit")}
      footerNote={t("footer")}
      onConfirm={async ({ message }) => {
        const next = await approveRequest(request.id, {
          message: message.trim() || null,
          serviceIds: services.length ? services.map((s) => s.value) : undefined,
        });
        refresh(next);
        toast.success(t("done", { reference: next.reference }));
      }}
    >
      <Field
        label={t("services")}
        hint={
          request.proposals.length
            ? t("alreadyProposed", { count: request.proposals.length })
            : t("servicesHint")
        }
      >
        <AsyncSelect
          value={picker}
          onValueChange={(o) => {
            if (o && !services.some((s) => s.value === o.value)) setServices([...services, o]);
            setPicker(null);
          }}
          queryKey={[...requestKeys.detail(request.id), "services"]}
          queryFn={search}
          placeholder={t("servicesPlaceholder")}
        />
      </Field>
      {services.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {services.map((s) => (
            <li
              key={s.value}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-brand-soft ps-2 pe-1 text-12 font-medium text-brand"
            >
              {s.label}
              <IconButton
                label={t("remove", { label: s.label })}
                size="sm"
                className="size-5"
                onClick={() => setServices(services.filter((x) => x.value !== s.value))}
              >
                <X className="size-3" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ ACR-04 ask for changes */

export function RequestChangesDialog({
  request,
  open,
  onOpenChange,
}: {
  request: RequestDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("academic.changes");
  const locale = useLocale();
  const refresh = useRefresh(request.id);
  const [fields, setFields] = useState<string[]>([]);
  const [missing, setMissing] = useState(false);
  const options = changeableFields(request.answers);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFields([]);
          setMissing(false);
        }
        onOpenChange(o);
      }}
      icon={<Pencil />}
      title={t("title")}
      description={t("description")}
      messageField={{ label: t("message"), required: true, placeholder: t("placeholder") }}
      confirmLabel={t("submit")}
      footerNote={t("footer")}
      onConfirm={async ({ message }) => {
        if (fields.length === 0) {
          setMissing(true);
          throw new Error(t("fieldsRequired"));
        }
        const next = await requestChanges(request.id, { fields, message: message.trim() });
        refresh(next);
        toast.success(t("done", { reference: next.reference }));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-13 font-medium text-ink">{t("fields")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((f) => (
            <Checkbox
              key={f.key}
              label={locale === "ar" ? f.labelAr || f.labelEn : f.labelEn || f.labelAr}
              checked={fields.includes(f.key)}
              onCheckedChange={(on) => {
                setMissing(false);
                setFields(on ? [...fields, f.key] : fields.filter((k) => k !== f.key));
              }}
            />
          ))}
        </div>
        {missing && (
          <p className="text-12 text-red" role="alert">
            {t("fieldsRequired")}
          </p>
        )}
      </fieldset>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ reject panel (ACR-02 aside) */

export function RejectPanel({ request, onCancel }: { request: RequestDetail; onCancel: () => void }) {
  const t = useTranslations("academic.reject");
  const tc = useTranslations("common");
  const refresh = useRefresh(request.id);
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = message.trim().length < 3;
  async function submit() {
    setSubmitted(true);
    if (tooShort) return;
    setPending(true);
    setError(null);
    try {
      const next = await rejectRequest(request.id, { reason, message: message.trim() });
      refresh(next);
      toast.success(t("done", { reference: next.reference }));
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="border-brand/30" id="reject">
      <CardHeader title={t("title")} />
      <CardBody className="flex flex-col gap-3">
        <RadioCards
          aria-label={t("reason")}
          value={reason}
          onValueChange={setReason}
          options={REJECT_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
        />
        <Field
          label={t("message")}
          required
          error={submitted && tooShort ? tc("required") : (error ?? undefined)}
        >
          <Textarea rows={3} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button variant="danger" icon={<X />} loading={pending} onClick={() => void submit()}>
            {t("submit")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ cancel */

export function CancelRequestDialog({
  request,
  open,
  onOpenChange,
}: {
  request: RequestDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("academic.cancel");
  const refresh = useRefresh(request.id);
  const pendingBookings = request.bookings.filter((b) => b.status === "pending").length;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<XCircle />}
      title={t("title", { reference: request.reference })}
      description={t("description")}
      impact={[t("impact1"), ...(pendingBookings ? [t("impact2", { count: pendingBookings })] : [])]}
      reasonField={{
        required: true,
        options: CANCEL_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })),
      }}
      confirmLabel={t("submit")}
      onConfirm={async ({ reason }) => {
        const next = await cancelRequest(request.id, { reason });
        refresh(next);
        toast.success(t("done", { reference: next.reference }));
      }}
    />
  );
}

/* ------------------------------------------------------------------ book a proposal */

export function BookProposalDialog({
  request,
  proposal,
  onOpenChange,
}: {
  request: RequestDetail;
  proposal: Proposal | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("academic.book");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = useRefresh(request.id);
  const [values, setValues] = useState({
    eventDate: "",
    startTime: "",
    endTime: "",
    guests: null as number | null,
    notes: "",
  });
  const [openFor, setOpenFor] = useState<string | null>(null);
  if (proposal && openFor !== proposal.id) {
    setOpenFor(proposal.id);
    setValues({
      eventDate: request.eventDate ?? "",
      startTime: "",
      endTime: "",
      guests: request.attendees,
      notes: "",
    });
  }
  const timesInvalid = !!values.startTime && !!values.endTime && values.endTime <= values.startTime;
  return (
    <ConfirmDialog
      open={!!proposal}
      onOpenChange={(o) => {
        if (!o) setOpenFor(null);
        onOpenChange(o);
      }}
      icon={<CalendarPlus />}
      title={t("title")}
      description={
        proposal &&
        t("description", {
          service:
            locale === "ar" ? proposal.service.titleAr || proposal.service.titleEn : proposal.service.titleEn,
          provider: proposal.service.businessName ?? proposal.service.provider.fullName,
        })
      }
      impact={[
        request.requester.userId
          ? t("impactLinked", { name: request.requester.name })
          : t("impactAccount", { email: request.requester.email }),
        t("impactBooking"),
        ...(request.status === "approved" ? [t("impactInProgress")] : []),
      ]}
      confirmLabel={t("submit")}
      onConfirm={async () => {
        if (!proposal) return;
        if (timesInvalid) throw new Error(t("timesInvalid"));
        const next = await bookProposal(request.id, proposal.id, {
          eventDate: values.eventDate || undefined,
          startTime: values.startTime || undefined,
          endTime: values.endTime || undefined,
          guests: values.guests ?? undefined,
          notes: values.notes.trim() || undefined,
        });
        refresh(next);
        void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
        const booking = bookedProposal(next, proposal.id);
        toast.success(t("done", { reference: booking?.reference ?? "" }));
        if (booking) router.push(`/bookings/${booking.id}`);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("date")} required>
          <DateInput
            value={values.eventDate}
            onValueChange={(eventDate) => setValues({ ...values, eventDate })}
          />
        </Field>
        <Field label={t("guests")}>
          <NumberInput value={values.guests} onValueChange={(guests) => setValues({ ...values, guests })} />
        </Field>
        <Field label={t("start")}>
          <TimeSelect
            value={values.startTime}
            onValueChange={(startTime) => setValues({ ...values, startTime })}
            placeholder={tc("select")}
          />
        </Field>
        <Field label={t("end")} error={timesInvalid ? t("timesInvalid") : undefined}>
          <TimeSelect
            value={values.endTime}
            onValueChange={(endTime) => setValues({ ...values, endTime })}
            placeholder={tc("select")}
          />
        </Field>
      </div>
      <Field label={t("notes")}>
        <Textarea
          value={values.notes}
          maxLength={2000}
          onChange={(e) => setValues({ ...values, notes: e.target.value })}
        />
      </Field>
      <p className={cn("text-12 text-muted")}>{t("availabilityNote")}</p>
    </ConfirmDialog>
  );
}
