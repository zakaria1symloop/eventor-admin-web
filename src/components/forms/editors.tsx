"use client";

import { ArrowRight, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Select, TextInput, Textarea } from "./fields";
import { NumberInput } from "./inputs";

/* ------------------------------------------------------------------ LineItemsEditor */

export interface LineItem {
  id: string;
  label: string;
  /** Arabic label when the editor is `bilingual` (service extras). */
  labelAr?: string;
  amount: number | null;
  /** Line kind when the editor has `kindOptions` (booking price: service, extra, discount…). */
  kind?: string;
  /** Quantity when `showQuantity` (then `amount` is the unit amount). */
  quantity?: number | null;
}

let lineSeq = 0;

export function LineItemsEditor({
  value,
  onChange,
  feePercent,
  base = 0,
  labelPlaceholder,
  labelArPlaceholder,
  addLabel,
  bilingual,
  hideSummary,
  errors,
  disabled,
  kindOptions,
  showQuantity,
  newLine,
}: {
  value: LineItem[];
  onChange: (items: LineItem[]) => void;
  /** Platform fee % (settings); shows fee + provider receives. */
  feePercent?: number;
  /** Amount added before the lines (e.g. base price). */
  base?: number;
  labelPlaceholder?: string;
  labelArPlaceholder?: string;
  addLabel?: ReactNode;
  /** Adds an Arabic label input (dir=rtl, Cairo) per line. */
  bilingual?: boolean;
  /** Hide the total / fee box (extras priced on top of a base price). */
  hideSummary?: boolean;
  /** Per-line error, keyed by line id. */
  errors?: Record<string, ReactNode | undefined>;
  disabled?: boolean;
  /** Adds a kind select per line (BKG-06). */
  kindOptions?: { value: string; label: string }[];
  /** Adds a quantity input; totals use quantity × amount. */
  showQuantity?: boolean;
  /** Extra fields for lines added with "Add line". */
  newLine?: Partial<LineItem>;
}) {
  const t = useTranslations("lineItems");
  const locale = useLocale();
  const total =
    base + value.reduce((s, l) => s + (l.amount ?? 0) * (showQuantity ? (l.quantity ?? 0) : 1), 0);
  const fee = feePercent !== undefined ? Math.round(total * feePercent) / 100 : null;
  const update = (id: string, p: Partial<LineItem>) =>
    onChange(value.map((l) => (l.id === id ? { ...l, ...p } : l)));

  return (
    <div className="flex flex-col gap-2">
      {value.map((l, i) => (
        <div key={l.id} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {kindOptions && (
              <div className="w-28 shrink-0">
                <Select
                  aria-label={t("kind", { n: i + 1 })}
                  value={l.kind ?? ""}
                  disabled={disabled}
                  options={kindOptions}
                  onChange={(e) => update(l.id, { kind: e.target.value })}
                />
              </div>
            )}
            <TextInput
              aria-label={t("label", { n: i + 1 })}
              value={l.label}
              placeholder={labelPlaceholder}
              disabled={disabled}
              aria-invalid={errors?.[l.id] ? true : undefined}
              onChange={(e) => update(l.id, { label: e.target.value })}
              className="min-w-[8rem] flex-1"
            />
            {bilingual && (
              <TextInput
                aria-label={t("labelAr", { n: i + 1 })}
                value={l.labelAr ?? ""}
                placeholder={labelArPlaceholder}
                disabled={disabled}
                dir="rtl"
                lang="ar"
                aria-invalid={errors?.[l.id] ? true : undefined}
                onChange={(e) => update(l.id, { labelAr: e.target.value })}
                className="min-w-0 flex-1 font-arabic"
              />
            )}
            {showQuantity && (
              <div className="w-20 shrink-0">
                <NumberInput
                  aria-label={t("quantity", { n: i + 1 })}
                  value={l.quantity ?? null}
                  disabled={disabled}
                  onValueChange={(quantity) => update(l.id, { quantity })}
                />
              </div>
            )}
            <div className="w-40">
              <NumberInput
                aria-label={t("amount", { n: i + 1 })}
                value={l.amount}
                suffix="DA"
                disabled={disabled}
                onValueChange={(amount) => update(l.id, { amount })}
              />
            </div>
            <IconButton
              label={t("remove")}
              disabled={disabled}
              onClick={() => onChange(value.filter((x) => x.id !== l.id))}
            >
              <Trash2 />
            </IconButton>
          </div>
          {errors?.[l.id] && (
            <p role="alert" className="text-12 text-red">
              {errors[l.id]}
            </p>
          )}
        </div>
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus />}
          disabled={disabled}
          onClick={() =>
            onChange([
              ...value,
              {
                id: `line-${++lineSeq}`,
                label: "",
                ...(bilingual ? { labelAr: "" } : {}),
                amount: null,
                ...newLine,
              },
            ])
          }
          className="text-brand"
        >
          {addLabel ?? t("add")}
        </Button>
      </div>
      {!hideSummary && (
        <dl className="mt-1 flex flex-col gap-1 rounded-lg bg-canvas px-4 py-3 text-13" aria-live="polite">
          <div className="flex justify-between">
            <dt className="text-muted">{t("total")}</dt>
            <dd className="font-semibold text-ink tabular-nums">{formatMoney(total, locale)}</dd>
          </div>
          {fee !== null && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">{t("fee", { percent: feePercent ?? 0 })}</dt>
                <dd className="text-ink-2 tabular-nums">{formatMoney(fee, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("providerReceives")}</dt>
                <dd className="font-medium text-green tabular-nums">{formatMoney(total - fee, locale)}</dd>
              </div>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ReasonPicker */

export interface ReasonOption {
  value: string;
  label: string;
  /** Prefilled message when picked. */
  message?: string;
}

export function ReasonPicker({
  reasons,
  value,
  onChange,
  variant = "chips",
  messageLabel,
  required,
  error,
  disabled,
}: {
  reasons: ReasonOption[];
  value: { reason: string; message: string };
  onChange: (value: { reason: string; message: string }) => void;
  variant?: "chips" | "select";
  messageLabel?: ReactNode;
  required?: boolean;
  error?: ReactNode;
  disabled?: boolean;
}) {
  const t = useTranslations("confirm");
  const tc = useTranslations("common");
  const pick = (reason: string) => {
    const prev = reasons.find((r) => r.value === value.reason);
    const next = reasons.find((r) => r.value === reason);
    // Replace the message only if the admin hasn't edited the previous prefill.
    const untouched = !value.message || value.message === prev?.message;
    onChange({ reason, message: untouched ? (next?.message ?? "") : value.message });
  };
  return (
    <div className="flex flex-col gap-3">
      {variant === "chips" ? (
        <div role="radiogroup" aria-label={t("reason")} className="flex flex-wrap gap-2">
          {reasons.map((r) => {
            const on = r.value === value.reason;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => pick(r.value)}
                className={cn(
                  "h-8 rounded-pill border px-3 text-13 transition-colors",
                  on
                    ? "border-brand/30 bg-brand-soft font-medium text-brand"
                    : "border-border bg-surface text-ink hover:bg-canvas",
                )}
              >
                {r.label}
              </button>
            );
          })}
          {error && (
            <p className="w-full text-12 text-red" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <Field label={t("reason")} required={required} error={error}>
          <Select
            value={value.reason}
            disabled={disabled}
            onChange={(e) => pick(e.target.value)}
            options={reasons}
            placeholder={tc("select")}
          />
        </Field>
      )}
      <Field label={messageLabel ?? t("message")}>
        <Textarea
          value={value.message}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ FormFooter */

export function FormFooter({
  isDirty,
  isValid = true,
  isSubmitting,
  onDiscard,
  submitLabel,
  note,
  form,
  sticky = true,
}: {
  isDirty: boolean;
  isValid?: boolean;
  isSubmitting?: boolean;
  onDiscard: () => void;
  submitLabel?: ReactNode;
  note?: ReactNode;
  /** id of the <form> when the footer sits outside it */
  form?: string;
  sticky?: boolean;
}) {
  const tc = useTranslations("common");
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-border bg-surface px-[18px] py-3",
        sticky && "sticky bottom-0 z-10",
      )}
    >
      <span className="me-auto text-12 text-muted">{note}</span>
      <Button variant="secondary" onClick={onDiscard} disabled={!isDirty || isSubmitting}>
        {tc("discard")}
      </Button>
      <Button type="submit" form={form} loading={isSubmitting} disabled={!isDirty || !isValid}>
        {submitLabel ?? tc("saveChanges")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ DiffList */

export interface DiffRow {
  label: ReactNode;
  old: ReactNode;
  new: ReactNode;
}

/** field: old → new (LOG-02, settings confirm). */
export function DiffList({ rows, className }: { rows: DiffRow[]; className?: string }) {
  const t = useTranslations("diff");
  const empty = <span className="text-faint">—</span>;
  return (
    <dl className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 gap-1 px-4 py-2.5 text-13 sm:grid-cols-[160px_1fr]">
          <dt className="text-muted">{r.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="sr-only">{t("old")}</span>
            <del className="rounded-xs bg-red-soft px-1.5 text-red no-underline">{r.old ?? empty}</del>
            <ArrowRight className="flip-rtl size-3.5 text-faint" aria-hidden />
            <span className="sr-only">{t("new")}</span>
            <ins className="rounded-xs bg-green-soft px-1.5 font-medium text-green no-underline">
              {r.new ?? empty}
            </ins>
          </dd>
        </div>
      ))}
    </dl>
  );
}
