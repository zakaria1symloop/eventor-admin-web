"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import { Check, ChevronDown, Minus } from "lucide-react";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

const controlBase =
  "w-full rounded-md border border-border bg-surface text-14 text-ink placeholder:text-faint transition-colors outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-red";

/* ------------------------------------------------------------------ Field */

export interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  /** Show the API `details[].message` here. */
  error?: ReactNode;
  className?: string;
  /** A single control; receives id / aria-describedby / aria-invalid. */
  children: ReactElement<Record<string, unknown>>;
}

export function Field({ label, required, hint, error, className, children }: FieldProps) {
  const autoId = useId();
  const id = (children.props.id as string | undefined) ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-13 font-medium text-ink">
          {label}
          {required && (
            <span aria-hidden className="ms-1 text-red">
              *
            </span>
          )}
        </label>
      )}
      {isValidElement(children)
        ? cloneElement(children, {
            id,
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
            "aria-required": required || undefined,
          })
        : children}
      {hint && !error && (
        <p id={hintId} className="text-12 text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-12 text-red">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Inputs */

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, "h-9 px-3", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(controlBase, "min-h-[64px] px-3 py-2.5", className)}
        {...props}
      />
    );
  },
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, "h-9 appearance-none ps-3 pe-9", className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
});

/* ------------------------------------------------------------------ Checkbox */

export interface CheckboxProps {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const cid = id ?? autoId;
  const box = (
    <RadixCheckbox.Root
      id={cid}
      checked={checked}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-xs border border-[#CFCBD8] bg-surface text-white transition-colors",
        "disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand",
        !label && className,
      )}
    >
      <RadixCheckbox.Indicator>
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
  if (!label) return box;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span className="pt-0.5">{box}</span>
      <label htmlFor={cid} className="text-13 text-ink">
        {label}
        {description && <span className="block text-12 text-muted">{description}</span>}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ Toggle */

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function Toggle({ checked, onCheckedChange, label, disabled, id, ...rest }: ToggleProps) {
  const autoId = useId();
  const tid = id ?? autoId;
  return (
    <div className="inline-flex items-center gap-2.5">
      <Switch.Root
        id={tid}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={rest["aria-label"]}
        className="relative h-5 w-9 shrink-0 rounded-pill bg-[#D6D3DD] transition-colors disabled:opacity-50 data-[state=checked]:bg-brand"
      >
        <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]" />
      </Switch.Root>
      {label && (
        <label htmlFor={tid} className="text-13 text-ink">
          {label}
        </label>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ RadioCards */

export interface RadioCardOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function RadioCards({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioCardOption[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-3", className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "group flex w-full items-start gap-3 rounded-md border border-border bg-surface px-3.5 py-3 text-start transition-colors",
            "disabled:opacity-50 data-[state=checked]:border-brand/40 data-[state=checked]:bg-brand-soft",
          )}
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-[#CFCBD8] bg-surface group-data-[state=checked]:border-[5px] group-data-[state=checked]:border-brand" />
          <span className="min-w-0">
            <span className="block text-14 font-medium text-ink group-data-[state=checked]:text-brand">
              {o.label}
            </span>
            {o.description && <span className="block text-12 text-muted">{o.description}</span>}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
