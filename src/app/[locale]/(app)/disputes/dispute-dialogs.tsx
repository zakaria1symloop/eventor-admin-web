"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, MessageSquareMore, Paperclip, TriangleAlert, X, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { toast } from "@/components/feedback/toast";
import { Checkbox, Field, RadioCards, Select, Textarea } from "@/components/forms/fields";
import { SegmentedControl } from "@/components/forms/inputs";
import { AsyncSelect, type Option } from "@/components/forms/select-inputs";
import { Button, IconButton } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { bookingKeys, getBooking, listBookings, offerTitle, type BookingStatus } from "@/lib/api/bookings";
import {
  addEvidence,
  closeDispute,
  DISPUTABLE_BOOKING_STATUSES,
  DISPUTE_OUTCOMES,
  DISPUTE_TYPES,
  disputeKeys,
  getDispute,
  openDispute,
  outcomeAllowed,
  outcomeResult,
  requestEvidence,
  resolveDispute,
  type DisputeDetail,
  type DisputeOutcome,
  type DisputeType,
} from "@/lib/api/disputes";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils/format";
import { formatBytes } from "@/components/domain/file-viewer";

const EVIDENCE_ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const EVIDENCE_MAX_MB = 5;

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: disputeKeys.all });
    void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  };
}

/* ------------------------------------------------------------------ open on behalf (DSP-01 ?new=1) */

type BookingOption = Option & {
  clientId: string;
  providerId: string;
  clientName: string;
  providerName: string;
  status: BookingStatus;
};

export function OpenDisputeDialog({
  open,
  onOpenChange,
  bookingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill from BKG-03 (`?new=1&booking=<id>`). */
  bookingId?: string | null;
}) {
  const t = useTranslations("disputes.open");
  const td = useTranslations("disputes");
  const tc = useTranslations("common");
  const tb = useTranslations("bookings");
  const locale = useLocale();
  const router = useRouter();
  const invalidate = useInvalidate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [booking, setBooking] = useState<BookingOption | null>(null);
  const [role, setRole] = useState<"client" | "provider">("client");
  const [type, setType] = useState<DisputeType | "">("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [windowClosed, setWindowClosed] = useState(false);
  const [ignoreWindow, setIgnoreWindow] = useState(false);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBooking(null);
      setRole("client");
      setType("");
      setDescription("");
      setFiles([]);
      setFileError(null);
      setWindowClosed(false);
      setIgnoreWindow(false);
      setNote("");
      setSubmitted(false);
      setError(null);
    }
  }

  // Prefilled booking (BKG-03 "Open dispute").
  const prefill = useQuery({
    queryKey: [...bookingKeys.all, "dispute-prefill", bookingId],
    queryFn: () => getBooking(bookingId!),
    enabled: open && !!bookingId,
  });
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (open && prefill.data && prefilledFor !== prefill.data.id) {
    setPrefilledFor(prefill.data.id);
    const b = prefill.data;
    setBooking({
      value: b.id,
      label: `#${b.reference} · ${b.offer.titleEn}`,
      clientId: b.client.id,
      providerId: b.provider.id,
      clientName: b.client.fullName,
      providerName: b.provider.businessName ?? b.provider.fullName,
      status: b.status,
    });
  }

  const searchBookings = async (q: string): Promise<BookingOption[]> => {
    const res = await listBookings({ q: q || undefined, limit: 20, sort: "eventDate:desc" });
    return res.data
      .filter((b) => DISPUTABLE_BOOKING_STATUSES.includes(b.status))
      .map((b) => ({
        value: b.id,
        label: `#${b.reference} · ${offerTitle(b, locale)}`,
        sub: [
          `${b.client.fullName} ↔ ${b.provider.businessName ?? b.provider.fullName}`,
          formatDate(`${b.eventDate}T12:00:00`, locale),
          tb(`tabs.${b.status}`),
          b.disputeStatus === "open" ? td("alreadyOpen") : null,
        ]
          .filter(Boolean)
          .join(" · "),
        clientId: b.client.id,
        providerId: b.provider.id,
        clientName: b.client.fullName,
        providerName: b.provider.businessName ?? b.provider.fullName,
        status: b.status,
      }));
  };

  function pickFiles(list: File[]) {
    const accepted: File[] = [];
    let problem: string | null = null;
    for (const f of list) {
      if (!EVIDENCE_ACCEPT.includes(f.type)) problem = t("fileType", { name: f.name });
      else if (f.size > EVIDENCE_MAX_MB * 1024 * 1024)
        problem = t("fileSize", { name: f.name, max: EVIDENCE_MAX_MB });
      else accepted.push(f);
    }
    setFileError(problem);
    setFiles((cur) => [...cur, ...accepted].slice(0, 10));
  }

  const descriptionTooShort = description.trim().length < 30;
  const invalid = !booking || !type || descriptionTooShort || (ignoreWindow && !note.trim());

  async function submit() {
    setSubmitted(true);
    if (invalid || !booking || !type) return;
    setPending(true);
    setError(null);
    try {
      const d = await openDispute({
        bookingId: booking.value,
        openedByRole: role,
        type,
        description: description.trim(),
        ...(ignoreWindow ? { ignoreWindow: true, note: note.trim() } : {}),
      });
      const partyUserId = role === "client" ? booking.clientId : booking.providerId;
      let failed = 0;
      for (const file of files) {
        try {
          await addEvidence(d.id, { file, partyUserId });
        } catch {
          failed += 1;
        }
      }
      invalidate();
      toast.success(t("created", { reference: d.reference }));
      if (failed) toast.error(t("uploadsFailed", { count: failed }));
      onOpenChange(false);
      router.push(`/disputes/${d.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "DISPUTE_WINDOW_CLOSED") {
        setWindowClosed(true);
        setError(t("windowClosed"));
      } else if (e instanceof ApiError && e.code === "DISPUTE_ALREADY_OPEN") {
        setError(t("alreadyOpen"));
      } else if (e instanceof ApiError && e.code === "BOOKING_NOT_DISPUTABLE") {
        setError(t("notDisputable"));
      } else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title={t("title")}
        description={t("description")}
        icon={<TriangleAlert />}
        width={600}
        footer={
          <>
            <span className="me-auto text-12 text-muted">{tc("savedInActivityLog")}</span>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button loading={pending} onClick={() => void submit()}>
              {t("submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone={windowClosed ? "amber" : "red"} title={error} />}
          <Field
            label={t("booking")}
            required
            error={submitted && !booking ? tc("required") : undefined}
            hint={t("bookingHint")}
          >
            <AsyncSelect
              value={booking}
              onValueChange={(o) => setBooking(o as BookingOption | null)}
              queryKey={[...bookingKeys.all, "dispute-search"]}
              queryFn={searchBookings}
              placeholder={t("bookingPlaceholder")}
            />
          </Field>
          <Field label={t("openedBy")} required>
            <SegmentedControl
              value={role}
              onValueChange={(v) => setRole(v as "client" | "provider")}
              options={[
                {
                  value: "client",
                  label: booking ? t("forClient", { name: booking.clientName }) : td("roles.client"),
                },
                {
                  value: "provider",
                  label: booking ? t("forProvider", { name: booking.providerName }) : td("roles.provider"),
                },
              ]}
            />
          </Field>
          <Field label={t("type")} required error={submitted && !type ? tc("required") : undefined}>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as DisputeType)}
              placeholder={tc("select")}
              options={DISPUTE_TYPES.map((k) => ({ value: k, label: td(`types.${k}`) }))}
            />
          </Field>
          <Field
            label={t("descriptionLabel")}
            required
            hint={t("descriptionHint")}
            error={submitted && descriptionTooShort ? t("descriptionMin") : undefined}
          >
            <Textarea
              rows={4}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-13 font-medium text-ink">{t("evidence")}</span>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-13"
                  >
                    <Paperclip className="size-4 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-12 text-muted">{formatBytes(f.size, locale)}</span>
                    <IconButton
                      label={t("removeFile", { name: f.name })}
                      size="sm"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <X />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileUp />}
                onClick={() => fileInput.current?.click()}
              >
                {t("addFiles")}
              </Button>
              <span className="ms-3 text-12 text-muted">{t("evidenceHint", { max: EVIDENCE_MAX_MB })}</span>
            </div>
            <input
              ref={fileInput}
              type="file"
              hidden
              multiple
              data-testid="evidence-input"
              accept={EVIDENCE_ACCEPT.join(",")}
              onChange={(e) => {
                pickFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            {fileError && (
              <p className="text-12 text-red" role="alert">
                {fileError}
              </p>
            )}
          </div>
          {(windowClosed || ignoreWindow) && (
            <div className="flex flex-col gap-3 rounded-lg bg-canvas p-3">
              <Checkbox
                checked={ignoreWindow}
                onCheckedChange={setIgnoreWindow}
                label={t("ignoreWindow")}
                description={t("ignoreWindowHint")}
              />
              {ignoreWindow && (
                <Field
                  label={t("note")}
                  required
                  error={submitted && !note.trim() ? tc("required") : undefined}
                >
                  <Textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
                </Field>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/* ------------------------------------------------------------------ resolve (DSP-03) */

export function ResolveDisputeDialog({
  disputeId,
  dispute,
  open,
  onOpenChange,
  onDone,
}: {
  disputeId: string | null;
  /** Detail when already loaded (DSP-02); otherwise it is fetched. */
  dispute?: DisputeDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (d: DisputeDetail) => void;
}) {
  const t = useTranslations("disputes.resolve");
  const tb = useTranslations("status.booking");
  const invalidate = useInvalidate();
  const loaded = useQuery({
    queryKey: disputeKeys.detail(disputeId ?? ""),
    queryFn: () => getDispute(disputeId!),
    enabled: open && !!disputeId && !dispute,
  });
  const d = dispute ?? loaded.data;
  const [outcome, setOutcome] = useState<DisputeOutcome | "">("");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOutcome("");
  }
  const bookingStatus = d?.booking.status;
  const [outcomeError, setOutcomeError] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setNote("");
      setNoteError(false);
      setOutcomeError(false);
    }
  }

  return (
    <ConfirmDialog
      open={open && !!d}
      onOpenChange={onOpenChange}
      tone="success"
      icon={<CheckCircle2 />}
      title={t("title", { reference: d?.reference ?? "" })}
      description={t("description")}
      confirmLabel={t("submit")}
      footerNote={t("footer")}
      onConfirm={async () => {
        setOutcomeError(!outcome);
        setNoteError(!note.trim());
        if (!outcome || !d) throw new Error(t("outcomeRequired"));
        if (!note.trim()) throw new Error(t("noteRequired"));
        const next = await resolveDispute(d.id, { bookingOutcome: outcome, decisionNote: note.trim() });
        invalidate();
        toast.success(t("done", { reference: next.reference }));
        onDone?.(next);
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-13 font-medium text-ink">{t("outcome")}</span>
        {bookingStatus && (
          <RadioCards
            aria-label={t("outcome")}
            value={outcome}
            onValueChange={(v) => {
              setOutcome(v as DisputeOutcome);
              setOutcomeError(false);
            }}
            options={DISPUTE_OUTCOMES.map((o) => {
              const allowed = outcomeAllowed(o, bookingStatus);
              const result = outcomeResult(o, bookingStatus);
              return {
                value: o,
                disabled: !allowed,
                label: t(`outcomes.${o}`),
                description: !allowed
                  ? t("notAllowed", { status: tb(bookingStatus) })
                  : o === "unchanged"
                    ? t("outcomeHints.unchanged")
                    : result
                      ? t(`outcomeHints.${o}`, { status: tb(result) })
                      : t("noChange", { status: tb(bookingStatus) }),
              };
            })}
          />
        )}
        {outcomeError && (
          <p className="text-12 text-red" role="alert">
            {t("outcomeRequired")}
          </p>
        )}
      </div>
      <Field label={t("note")} required error={noteError ? t("noteRequired") : undefined}>
        <Textarea
          rows={4}
          maxLength={5000}
          value={note}
          placeholder={t("notePlaceholder")}
          onChange={(e) => {
            setNote(e.target.value);
            if (e.target.value.trim()) setNoteError(false);
          }}
        />
      </Field>
      <p className="rounded-lg bg-canvas px-3 py-2.5 text-12 text-muted">{t("cashInfo")}</p>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ close / ask for evidence / add evidence */

export function CloseDisputeDialog({
  dispute,
  open,
  onOpenChange,
  onDone,
}: {
  dispute: { id: string; reference: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (d: DisputeDetail) => void;
}) {
  const t = useTranslations("disputes.close");
  const invalidate = useInvalidate();
  return (
    <ConfirmDialog
      open={open && !!dispute}
      onOpenChange={onOpenChange}
      tone="warning"
      icon={<XCircle />}
      title={t("title", { reference: dispute?.reference ?? "" })}
      description={t("description")}
      impact={[t("impact1"), t("impact2")]}
      messageField={{ label: t("note"), required: true }}
      confirmLabel={t("submit")}
      onConfirm={async ({ message }) => {
        const next = await closeDispute(dispute!.id, { note: message.trim() });
        invalidate();
        toast.success(t("done", { reference: next.reference }));
        onDone?.(next);
      }}
    />
  );
}

function PartyPicker({
  dispute,
  value,
  onChange,
}: {
  dispute: DisputeDetail;
  value: string;
  onChange: (id: string) => void;
}) {
  const td = useTranslations("disputes");
  const sides = [dispute.sides.client, dispute.sides.provider];
  return (
    <RadioCards
      aria-label={td("detail.party")}
      value={value}
      onValueChange={onChange}
      options={sides.map((s) => ({
        value: s.id,
        label: s.businessName ?? s.fullName,
        description: td(`roles.${s.role}`),
      }))}
    />
  );
}

export function AskEvidenceDialog({
  dispute,
  open,
  onOpenChange,
  onDone,
}: {
  dispute: DisputeDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (d: DisputeDetail) => void;
}) {
  const t = useTranslations("disputes.askEvidence");
  const invalidate = useInvalidate();
  const [party, setParty] = useState(dispute.against.id);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<MessageSquareMore />}
      title={t("title")}
      description={t("description")}
      messageField={{ label: t("message"), required: true, placeholder: t("placeholder") }}
      confirmLabel={t("submit")}
      onConfirm={async ({ message }) => {
        const next = await requestEvidence(dispute.id, { fromUserId: party, message: message.trim() });
        invalidate();
        toast.success(t("done"));
        onDone?.(next);
      }}
    >
      <PartyPicker dispute={dispute} value={party} onChange={setParty} />
    </ConfirmDialog>
  );
}

export function AddEvidenceDialog({
  dispute,
  open,
  onOpenChange,
  onDone,
}: {
  dispute: DisputeDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (d: DisputeDetail) => void;
}) {
  const t = useTranslations("disputes.addEvidence");
  const locale = useLocale();
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement>(null);
  const [party, setParty] = useState(dispute.openedBy.id);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<ReactNode>(null);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFile(null);
          setFileError(null);
        }
        onOpenChange(o);
      }}
      icon={<FileUp />}
      title={t("title")}
      description={t("description")}
      messageField={{ label: t("note") }}
      confirmLabel={t("submit")}
      onConfirm={async ({ message }) => {
        if (!file) {
          setFileError(t("fileRequired"));
          throw new Error(t("fileRequired"));
        }
        const next = await addEvidence(dispute.id, {
          file,
          partyUserId: party,
          note: message.trim() || undefined,
        });
        invalidate();
        toast.success(t("done"));
        onDone?.(next);
      }}
    >
      <PartyPicker dispute={dispute} value={party} onChange={setParty} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<FileUp />} onClick={() => input.current?.click()}>
          {file ? t("replaceFile") : t("chooseFile")}
        </Button>
        {file && (
          <span className="text-13 text-ink">
            {file.name} <span className="text-muted">· {formatBytes(file.size, locale)}</span>
          </span>
        )}
        <input
          ref={input}
          type="file"
          hidden
          accept={EVIDENCE_ACCEPT.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (!EVIDENCE_ACCEPT.includes(f.type)) return setFileError(t("fileType"));
            if (f.size > EVIDENCE_MAX_MB * 1024 * 1024)
              return setFileError(t("fileSize", { max: EVIDENCE_MAX_MB }));
            setFileError(null);
            setFile(f);
          }}
        />
      </div>
      {fileError && (
        <p className="text-12 text-red" role="alert">
          {fileError}
        </p>
      )}
    </ConfirmDialog>
  );
}
