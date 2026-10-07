"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, ListFilter, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Select } from "@/components/forms/fields";
import { SearchBox } from "@/components/forms/select-inputs";
import { DROPDOWN_COLLISION_PADDING, dropdownList, popoverListSurface } from "@/components/ui/dropdown";
import type { FilterConfig } from "./use-list-state";

/* ------------------------------------------------------------------ SearchInput (debounced) */

export function DebouncedSearch({
  value,
  onChange,
  placeholder,
  delay = 300,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}) {
  const t = useTranslations("dataList");
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // External reset (e.g. "Clear all").
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setLocal(value);
  }

  useEffect(() => {
    if (local === value) return;
    const id = setTimeout(() => onChangeRef.current(local), delay);
    return () => clearTimeout(id);
  }, [local, value, delay]);

  return (
    <label className={cn("relative block w-full sm:w-[200px] xl:w-[220px]", className)}>
      <span className="sr-only">{t("search")}</span>
      <Search
        aria-hidden
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-surface ps-9 pe-3 text-13 text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ FilterSelect */

export function FilterSelect({
  filter,
  value,
  onChange,
}: {
  filter: FilterConfig;
  value: string | string[] | undefined;
  onChange: (value: string | string[] | null) => void;
}) {
  const tf = useTranslations("forms");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const isSet = selected.length > 0;
  const labels = selected.map((v) => filter.options.find((o) => o.value === v)?.label ?? v);
  // Long lists (clients, providers, wilayas…) get a search box.
  const searchable = filter.options.length > 8;
  const shown = q ? filter.options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : filter.options;

  function toggle(v: string) {
    if (filter.multiple) {
      onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
    } else {
      onChange(selected[0] === v ? null : v);
      setOpen(false);
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
      modal
    >
      <Popover.Trigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-13 whitespace-nowrap transition-colors",
          isSet
            ? "border-brand/25 bg-brand-soft text-brand"
            : "border-border bg-surface text-ink hover:bg-canvas",
        )}
      >
        {isSet ? (
          <>
            <span>{filter.label}:</span>
            <span className="max-w-[140px] truncate font-medium">
              {labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0]}
            </span>
          </>
        ) : (
          filter.label
        )}
        <ChevronDown aria-hidden className="size-4 opacity-70" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={DROPDOWN_COLLISION_PADDING}
          className={cn(popoverListSurface, "w-max min-w-[220px] max-w-[min(320px,calc(100vw-16px))]")}
        >
          {searchable && <SearchBox value={q} onChange={setQ} placeholder={tf("search")} />}
          <ul
            role="listbox"
            aria-label={filter.label}
            aria-multiselectable={filter.multiple || undefined}
            className={dropdownList}
          >
            {shown.map((o) => {
              const on = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(o.value)}
                    className="flex min-h-8 w-full items-center gap-2.5 rounded-sm px-2 py-1 text-start text-13 text-ink hover:bg-canvas"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-xs border",
                        on ? "border-brand bg-brand text-white" : "border-[#CFCBD8]",
                        !filter.multiple && "rounded-full",
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{o.label}</span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-2 py-3 text-13 text-muted">{tf("noOptions")}</li>}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ SortSelect */

export function SortSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const t = useTranslations("dataList");
  return (
    <label className="flex items-center gap-2 text-13 text-muted">
      <span>{t("sort")}:</span>
      <Select
        aria-label={t("sort")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        className="h-9 w-auto text-13 font-medium"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ FilterChips */

export function FilterChips({
  filters,
  values,
  onRemove,
  onClearAll,
  onSaveView,
}: {
  filters: FilterConfig[];
  values: Record<string, string | string[]>;
  onRemove: (key: string) => void;
  onClearAll: () => void;
  onSaveView?: () => void;
}) {
  const t = useTranslations("dataList");
  const seen = new Set<string>();
  const active = filters.filter((f) => {
    if (values[f.key] === undefined || seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      {active.map((f) => {
        const v = values[f.key];
        const list = Array.isArray(v) ? v : [v];
        const text = f.format
          ? f.format(v)
          : list.map((x) => f.options.find((o) => o.value === x)?.label ?? x).join(", ");
        return (
          <span
            key={f.key}
            className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-brand-soft ps-3 pe-1 text-12 text-brand"
          >
            {f.label}: <span className="font-medium">{text}</span>
            <button
              type="button"
              aria-label={t("removeFilter", { label: f.label })}
              onClick={() => onRemove(f.key)}
              className="flex size-5 items-center justify-center rounded-full hover:bg-brand/10"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        );
      })}
      <button type="button" onClick={onClearAll} className="text-12 font-medium text-brand hover:underline">
        {t("clearAll")}
      </button>
      {onSaveView && (
        <button type="button" onClick={onSaveView} className="text-12 font-medium text-brand hover:underline">
          {t("saveAsView")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ FilterBar */

export function FilterBar({
  search,
  filters,
  moreFilters,
  moreFiltersCount = 0,
  end,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  /** Opens the AdvancedFiltersDrawer. */
  moreFilters?: () => void;
  /** Active advanced filters, shown next to "More filters". */
  moreFiltersCount?: number;
  end?: ReactNode;
}) {
  const t = useTranslations("dataList");
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {search}
      {filters}
      {moreFilters && (
        <button
          type="button"
          onClick={moreFilters}
          className="inline-flex h-9 items-center gap-1.5 px-2 text-13 font-medium text-brand"
        >
          <ListFilter aria-hidden className="size-4" />
          {t("moreFilters")}
          {moreFiltersCount > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-brand px-1 text-11 text-white">
              {moreFiltersCount}
            </span>
          )}
        </button>
      )}
      {end && <div className="ms-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}
