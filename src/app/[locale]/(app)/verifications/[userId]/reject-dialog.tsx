"use client";

import { Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Banner } from "@/components/feedback/banner";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { toast } from "@/components/feedback/toast";
import { Field, Select } from "@/components/forms/fields";
import { ReasonPicker } from "@/components/forms/editors";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import type { DocumentType } from "@/lib/api/users";
import { DOCUMENT_TYPES, REJECT_REASONS, uploadDocument, type RejectReason } from "@/lib/api/verifications";

/* ------------------------------------------------------------------ VER-03 reject */

export function RejectDocumentDialog({
  open,
  onOpenChange,
  documentLabel,
  userName,
  businessName,
  onReject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentLabel: string;
  userName: string;
  businessName?: string | null;
  /** Throw to keep the dialog open with the error. */
  onReject: (body: { reasonCode: RejectReason; message: string }) => Promise<void>;
}) {
  const t = useTranslations("verifications.reject");
  const tc = useTranslations("common");
  const [value, setValue] = useState({ reason: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue({ reason: "", message: "" });
      setSubmitted(false);
      setError(null);
      setPending(false);
    }
  }

  const vars = { document: documentLabel, name: userName, business: businessName || userName };
  const reasons = REJECT_REASONS.map((r) => ({
    value: r,
    label: t(`reasons.${r}`),
    message: r === "other" ? "" : t(`messages.${r}`, vars),
  }));
  const reasonMissing = !value.reason;
  const messageMissing = !value.message.trim();

  async function submit() {
    setSubmitted(true);
    if (reasonMissing || messageMissing) return;
    setPending(true);
    setError(null);
    try {
      await onReject({ reasonCode: value.reason as RejectReason, message: value.message.trim() });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  const firstName = userName.split(/\s+/)[0];

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title={t("title", { document: documentLabel })}
        description={t("description", { name: firstName })}
        icon={<X />}
        tone="danger"
        width={540}
        footer={
          <>
            <span className="me-auto text-12 text-muted">{t("footer")}</span>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" icon={<X />} loading={pending} onClick={submit}>
              {t("confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="red" title={error} />}
          <div>
            <div className="mb-2 text-13 font-medium text-ink">{t("reason")}</div>
            <ReasonPicker
              reasons={reasons}
              value={value}
              onChange={setValue}
              disabled={pending}
              error={submitted && reasonMissing ? t("reasonRequired") : undefined}
              messageLabel={
                <>
                  {t("message")}
                  <span aria-hidden className="ms-1 text-red">
                    *
                  </span>
                </>
              }
            />
            {submitted && messageMissing && (
              <p role="alert" className="mt-1.5 text-12 text-red">
                {t("messageRequired")}
              </p>
            )}
            <p className="mt-1.5 text-12 text-muted">{t("hint")}</p>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/* ------------------------------------------------------------------ upload on behalf */

export function UploadDocumentDialog({
  open,
  onOpenChange,
  userId,
  userName,
  defaultType,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  defaultType?: DocumentType;
  onUploaded?: () => void;
}) {
  const t = useTranslations("verifications.upload");
  const tu = useTranslations("users");
  const tc = useTranslations("common");
  const [type, setType] = useState<DocumentType>(defaultType ?? "national_id");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setType(defaultType ?? "national_id");
      setFile(null);
      setError(null);
    }
  }

  async function submit() {
    if (!file) return setError(t("pickFile"));
    setPending(true);
    setError(null);
    try {
      await uploadDocument(userId, type, file);
      toast.success(t("done", { type: tu(`documentTypes.${type}`) }));
      onUploaded?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title={t("title")}
        description={t("description", { name: userName })}
        icon={<Upload />}
        width={480}
        footer={
          <>
            <span className="me-auto text-12 text-muted">{t("footer")}</span>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button icon={<Upload />} loading={pending} onClick={submit}>
              {t("confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="red" title={error} />}
          <Field label={t("type")}>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              options={DOCUMENT_TYPES.map((d) => ({ value: d, label: tu(`documentTypes.${d}`) }))}
            />
          </Field>
          <Field label={t("file")} hint={t("fileHint")}>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-13 text-ink file:me-3 file:h-9 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:text-13 file:font-medium file:text-ink"
            />
          </Field>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
