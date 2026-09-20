"use client";

import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface Option {
  value: string;
  label: string;
  sub?: ReactNode;
}

const triggerClass =
  "flex min-h-9 w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-start text-14 text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/15 aria-[invalid=true]:border-red disabled:bg-canvas";

function OptionRow({
  option,
  selected,
  multiple,
  onClick,
}: {
  option: Option;
  selected: boolean;
  multiple?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className="flex min-h-8 w-full items-center gap-2.5 rounded-sm px-2 py-1 text-start text-13 text-ink hover:bg-canvas"
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center border",
            multiple ? "rounded-xs" : "rounded-full",
            selected ? "border-brand bg-brand text-white" : "border-[#CFCBD8]",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate">{option.label}</span>
          {option.sub && <span className="block truncate text-12 text-muted">{option.sub}</span>}
        </span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ MultiSelect */

export interface MultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Chips in the trigger (Figma "Alger ✕ Add a wilaya…"), checkbox list in a popover. */
export function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchable = options.length > 8,
  disabled,
  ...aria
}: MultiSelectProps) {
  const t = useTranslations("forms");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (v: string) =>
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button type="button" {...aria} className={triggerClass}>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {value.length === 0 && <span className="px-1 text-faint">{placeholder ?? t("selectMany")}</span>}
            {value.map((v) => {
              const label = options.find((o) => o.value === v)?.label ?? v;
              return (
                <span
                  key={v}
                  className="inline-flex h-6 items-center gap-1 rounded-sm bg-brand-soft ps-2 pe-1 text-12 font-medium text-brand"
                >
                  {label}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={t("remove", { label })}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }}
                    className="flex size-4 items-center justify-center rounded-full hover:bg-brand/10"
                  >
                    <X className="size-3" aria-hidden />
                  </span>
                </span>
              );
            })}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="z-50 min-w-[220px] rounded-lg border border-border bg-surface p-1.5 shadow-overlay"
        >
          {searchable && <SearchBox value={q} onChange={setQ} placeholder={t("search")} />}
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <OptionRow
                key={o.value}
                option={o}
                multiple
                selected={value.includes(o.value)}
                onClick={() => toggle(o.value)}
              />
            ))}
            {shown.length === 0 && <li className="px-2 py-3 text-13 text-muted">{t("noOptions")}</li>}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative mb-1 block">
      <span className="sr-only">{placeholder}</span>
      <Search
        aria-hidden
        className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
      <input
        autoFocus
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-sm border border-border ps-8 pe-2 text-13 outline-none focus:border-brand"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ AsyncSelect */

export interface AsyncSelectProps {
  value: Option | null;
  onValueChange: (value: Option | null) => void;
  /** Search API (users, services, wilayas…). Called with the debounced query. */
  queryFn: (q: string) => Promise<Option[]>;
  queryKey: readonly unknown[];
  placeholder?: string;
  minChars?: number;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function AsyncSelect({
  value,
  onValueChange,
  queryFn,
  queryKey,
  placeholder,
  minChars = 0,
  disabled,
  ...aria
}: AsyncSelectProps) {
  const t = useTranslations("forms");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const query = useQuery({
    queryKey: [...queryKey, "search", debounced],
    queryFn: () => queryFn(debounced),
    enabled: open && debounced.length >= minChars,
    staleTime: 30_000,
  });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button type="button" {...aria} className={cn(triggerClass, "px-3")}>
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-faint")}>
            {value ? value.label : (placeholder ?? t("search"))}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={t("clear")}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onValueChange(null);
              }}
              className="flex size-5 items-center justify-center rounded-full text-muted hover:bg-gray-soft"
            >
              <X className="size-3.5" aria-hidden />
            </span>
          )}
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="z-50 min-w-[240px] rounded-lg border border-border bg-surface p-1.5 shadow-overlay"
        >
          <SearchBox value={q} onChange={setQ} placeholder={t("search")} />
          <ul role="listbox" className="max-h-64 overflow-y-auto" aria-busy={query.isFetching || undefined}>
            {debounced.length < minChars ? (
              <li className="px-2 py-3 text-13 text-muted">{t("typeToSearch", { count: minChars })}</li>
            ) : query.isPending ? (
              <li className="flex items-center gap-2 px-2 py-3 text-13 text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden /> {t("searching")}
              </li>
            ) : query.isError ? (
              <li className="px-2 py-3 text-13 text-red">{t("searchFailed")}</li>
            ) : query.data.length === 0 ? (
              <li className="px-2 py-3 text-13 text-muted">{t("noOptions")}</li>
            ) : (
              query.data.map((o) => (
                <OptionRow
                  key={o.value}
                  option={o}
                  selected={value?.value === o.value}
                  onClick={() => {
                    onValueChange(o);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
