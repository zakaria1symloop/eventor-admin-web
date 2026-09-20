"use client";

import { Calendar, Eye, EyeOff, Mail } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { normalizeDzPhone } from "@/lib/utils/format";
import { Select, TextInput } from "./fields";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/* ------------------------------------------------------------------ NumberInput (suffix: DA, %, px, MB) */

export interface NumberInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  suffix?: ReactNode;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValueChange, suffix, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <TextInput
        ref={ref}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,-]/g, "").replace(",", ".");
          if (raw === "") return onValueChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onValueChange(n);
        }}
        className={cn("text-end tabular-nums rtl:text-start", suffix ? "pe-12" : undefined, className)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-13 text-faint">
          {suffix}
        </span>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ PhoneInput (+213) */

export interface PhoneInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  /** E.164 (+213XXXXXXXXX) or whatever the admin typed when it can't be normalised. */
  value: string;
  onValueChange: (value: string) => void;
}

function localPart(value: string) {
  return value.startsWith("+213") ? `0${value.slice(4)}` : value;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onValueChange, className, onBlur, ...props },
  ref,
) {
  const [draft, setDraft] = useState(localPart(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (normalizeDzPhone(draft) !== value) setDraft(localPart(value));
  }
  return (
    <div className="flex" dir="ltr">
      <span className="inline-flex h-9 items-center rounded-s-md border border-e-0 border-border bg-canvas px-3 text-13 text-muted">
        +213
      </span>
      <TextInput
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = normalizeDzPhone(e.target.value);
          onValueChange(n ?? e.target.value);
        }}
        onBlur={(e) => {
          const n = normalizeDzPhone(draft);
          if (n) setDraft(localPart(n));
          onBlur?.(e);
        }}
        className={cn("rounded-s-none", className)}
        placeholder="0550 12 34 56"
        {...props}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ EmailInput */

export const EmailInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function EmailInput(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative" dir="ltr">
      <Mail
        aria-hidden
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint"
      />
      <TextInput
        ref={ref}
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        dir="ltr"
        className={cn("ps-9", className)}
        {...props}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ PasswordInput (show / hide) */

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const t = useTranslations("forms");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput
        ref={ref}
        type={visible ? "text" : "password"}
        dir="ltr"
        className={cn("pe-10 rtl:text-end", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute end-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
});

/* ------------------------------------------------------------------ SegmentedControl */

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export function SegmentedControl({
  value,
  onValueChange,
  options,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex w-full items-center rounded-md bg-gray-soft p-[3px]", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "flex-1 rounded-sm px-3 text-13 whitespace-nowrap transition-colors disabled:opacity-50",
              size === "sm" ? "h-7" : "h-[30px]",
              on
                ? "bg-surface font-medium text-ink shadow-sm ring-1 ring-border"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ DateInput / DateRangeInput */

export interface DateInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  /** YYYY-MM-DD or "" */
  value: string;
  onValueChange: (value: string) => void;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onValueChange, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <TextInput
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn("pe-9 [&::-webkit-calendar-picker-indicator]:opacity-0", className)}
        {...props}
      />
      <Calendar
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
});

export interface DateRange {
  from: string;
  to: string;
}

export function DateRangeInput({
  value,
  onValueChange,
  min,
  max,
  "aria-label": ariaLabel,
}: {
  value: DateRange;
  onValueChange: (value: DateRange) => void;
  min?: string;
  max?: string;
  "aria-label"?: string;
}) {
  const t = useTranslations("forms");
  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-2">
      <div className="flex-1">
        <DateInput
          aria-label={t("from")}
          value={value.from}
          min={min}
          max={value.to || max}
          onValueChange={(from) => onValueChange({ ...value, from })}
        />
      </div>
      <span className="text-13 text-muted">{t("to")}</span>
      <div className="flex-1">
        <DateInput
          aria-label={t("toDate")}
          value={value.to}
          min={value.from || min}
          max={max}
          onValueChange={(to) => onValueChange({ ...value, to })}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ TimeSelect (HH:mm, Africa/Algiers) */

export function timeOptions(stepMinutes = 30, from = "00:00", to = "23:59") {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const out: { value: string; label: string }[] = [];
  for (let m = toMin(from); m <= toMin(to); m += stepMinutes) {
    const v = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    out.push({ value: v, label: v });
  }
  return out;
}

export function TimeSelect({
  value,
  onValueChange,
  step = 30,
  from,
  to,
  placeholder,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  step?: number;
  from?: string;
  to?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const tc = useTranslations("common");
  return (
    <Select
      {...rest}
      dir="ltr"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      options={timeOptions(step, from, to)}
      placeholder={placeholder ?? tc("select")}
    />
  );
}
