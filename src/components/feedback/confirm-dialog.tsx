"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toneClasses } from "@/components/ui/badge";
import { Checkbox, Field, Select, TextInput, Textarea, type SelectOption } from "@/components/forms/fields";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { Banner } from "./banner";
import { DialogContent, DialogRoot, dialogToneMap, type DialogTone } from "./dialog";

export interface ConfirmValues {
  reason: string;
  message: string;
  checkboxes: Record<string, boolean>;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  tone?: DialogTone;
  icon?: ReactNode;
  /** "What happens" box. */
  impact?: ReactNode[];
  impactTitle?: ReactNode;
  reasonField?: {
    label?: ReactNode;
    options: SelectOption[];
    required?: boolean;
    placeholder?: string;
    /** Validation message when required and empty (default "Pick a reason"). */
    requiredMessage?: ReactNode;
    /** Rendered next to the reason select (two columns), e.g. a duration select (USR-07). */
    addon?: ReactNode;
  };
  messageField?: {
    label?: ReactNode;
    placeholder?: string;
    required?: boolean;
    defaultValue?: string;
  };
  checkboxes?: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean }[];
  /** The user must type this exact value to enable confirm. */
  typeToConfirm?: string;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  secondaryAction?: { label: ReactNode; onClick: () => void };
  /** Left side of the footer, e.g. "Saved in the activity log". */
  footerNote?: ReactNode;
  /** Extra content between impact and fields (e.g. RadioCards). */
  children?: ReactNode;
  /** Async. Resolve → dialog closes. Throw → dialog stays open with values and shows the error. */
  onConfirm: (values: ConfirmValues) => void | Promise<void>;
}

function initialValues(props: ConfirmDialogProps): ConfirmValues {
  return {
    reason: "",
    message: props.messageField?.defaultValue ?? "",
    checkboxes: Object.fromEntries((props.checkboxes ?? []).map((c) => [c.name, !!c.defaultChecked])),
  };
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    tone = "default",
    icon,
    impact,
    impactTitle,
    reasonField,
    messageField,
    checkboxes,
    typeToConfirm,
    confirmLabel,
    cancelLabel,
    secondaryAction,
    footerNote,
    children,
    onConfirm,
  } = props;
  const t = useTranslations("confirm");
  const tc = useTranslations("common");
  const typeId = useId();

  const [values, setValues] = useState<ConfirmValues>(() => initialValues(props));
  const [typed, setTyped] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Reset only when the dialog (re)opens, so data is kept after an error.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setPending(false);
    if (open) {
      setValues(initialValues(props));
      setTyped("");
      setSubmitted(false);
      setError(null);
    }
  }

  const reasonMissing = !!reasonField?.required && !values.reason;
  const messageMissing = !!messageField?.required && !values.message.trim();
  const typeMismatch = !!typeToConfirm && typed.trim() !== typeToConfirm;
  const tones = toneClasses[dialogToneMap[tone]];

  async function handleConfirm() {
    setSubmitted(true);
    if (reasonMissing || messageMissing || typeMismatch) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(values);
      setPending(false);
      onOpenChange(false);
    } catch (e) {
      setPending(false);
      setError(e);
    }
  }

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : error
          ? String(error)
          : null;

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title={title}
        description={description}
        icon={icon}
        tone={tone}
        onInteractOutside={(e) => pending && e.preventDefault()}
        footer={
          <>
            {footerNote && <span className="me-auto text-12 text-muted">{footerNote}</span>}
            {!footerNote && <span className="me-auto" />}
            {secondaryAction && (
              <Button variant="ghost" onClick={secondaryAction.onClick} disabled={pending}>
                {secondaryAction.label}
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel ?? tc("cancel")}
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              icon={tone === "danger" ? icon : undefined}
              loading={pending}
              disabled={typeMismatch}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {errorMessage && (
            <Banner
              tone="red"
              title={errorMessage}
              description={
                error instanceof ApiError && error.requestId ? `Request ID: ${error.requestId}` : undefined
              }
            />
          )}

          {impact && impact.length > 0 && (
            <div className={cn("rounded-lg px-4 py-3", tone === "default" ? "bg-canvas" : tones.soft)}>
              <div className={cn("mb-1 text-13 font-medium", tone === "default" ? "text-ink" : tones.text)}>
                {impactTitle ?? t("whatHappens")}
              </div>
              <ul className="list-inside list-disc text-13 text-ink marker:text-ink-2">
                {impact.map((item, i) => (
                  <li key={i} className="py-0.5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {children}

          {reasonField && (
            <div className={cn(reasonField.addon && "grid gap-4 sm:grid-cols-2")}>
              <Field
                label={reasonField.label ?? t("reason")}
                required={reasonField.required}
                error={
                  submitted && reasonMissing
                    ? (reasonField.requiredMessage ?? t("reasonRequired"))
                    : undefined
                }
              >
                <Select
                  value={values.reason}
                  onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
                  options={reasonField.options}
                  placeholder={reasonField.placeholder ?? tc("select")}
                  disabled={pending}
                />
              </Field>
              {reasonField.addon}
            </div>
          )}

          {messageField && (
            <Field
              label={messageField.label ?? t("message")}
              required={messageField.required}
              error={submitted && messageMissing ? tc("required") : undefined}
            >
              <Textarea
                value={values.message}
                placeholder={messageField.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
                disabled={pending}
              />
            </Field>
          )}

          {checkboxes?.map((c) => (
            <Checkbox
              key={c.name}
              label={c.label}
              description={c.description}
              checked={values.checkboxes[c.name] ?? false}
              disabled={pending}
              onCheckedChange={(checked) =>
                setValues((v) => ({ ...v, checkboxes: { ...v.checkboxes, [c.name]: checked } }))
              }
            />
          ))}

          {typeToConfirm && (
            <Field
              label={t("typeToConfirm", { value: typeToConfirm })}
              error={submitted && typeMismatch && typed ? t("typeMismatch") : undefined}
            >
              <TextInput
                id={typeId}
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                disabled={pending}
              />
            </Field>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
