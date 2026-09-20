"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bookmark, Check } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { DialogRoot, DrawerContent } from "@/components/feedback/dialog";
import { Select, Toggle } from "@/components/forms/fields";
import { DateRangeInput, NumberInput, SegmentedControl } from "@/components/forms/inputs";
import { MultiSelect } from "@/components/forms/select-inputs";
import { FilterChips } from "./filter-bar";
import type { FilterConfig } from "./use-list-state";

type Opt = { value: string; label: string; hint?: ReactNode };

export type AdvancedFilterField =
  | { key: string; label: string; type: "select"; options: Opt[]; hint?: ReactNode }
  | {
      key: string;
      label: string;
      type: "multiselect";
      options: Opt[];
      display?: "chips" | "dropdown";
      hint?: ReactNode;
    }
  | { key: string; label: string; type: "segmented"; options: Opt[]; hint?: ReactNode }
  | { key: string; label: string; type: "toggle"; toggleLabel?: string; hint?: ReactNode }
  | { key: string; label: string; type: "range"; suffix?: string; hint?: ReactNode }
  | { key: string; label: string; type: "daterange"; hint?: ReactNode };

export type FilterValues = Record<string, string | string[]>;

/** Ranges are stored in the URL as `min..max` (either side may be empty). */
export function parseRange(v: string | string[] | undefined): { from: string; to: string } {
  const s = typeof v === "string" ? v : "";
  const [from = "", to = ""] = s.split("..");
  return { from, to };
}
export function formatRange(from: string, to: string): string {
  return from || to ? `${from}..${to}` : "";
}

/** URL/chip configuration for advanced fields (used by useListState and FilterChips). */
export function advancedToFilterConfigs(
  fields: AdvancedFilterField[],
  labels: { yes: string; any: string },
): FilterConfig[] {
  return fields.map((f) => {
    const options = "options" in f ? f.options.map((o) => ({ value: o.value, label: o.label })) : [];
    let format: FilterConfig["format"];
    if (f.type === "range" || f.type === "daterange") {
      format = (v) => {
        const { from, to } = parseRange(v);
        const sfx = f.type === "range" && f.suffix ? ` ${f.suffix}` : "";
        if (from && to) return `${from}–${to}${sfx}`;
        return from ? `≥ ${from}${sfx}` : `≤ ${to}${sfx}`;
      };
    } else if (f.type === "toggle") {
      format = () => labels.yes;
    }
    return { key: f.key, label: f.label, options, multiple: f.type === "multiselect", format };
  });
}

function isEmpty(v: string | string[] | undefined) {
  return v === undefined || (Array.isArray(v) ? v.length === 0 : v === "");
}

export function cleanValues(values: FilterValues): FilterValues {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => !isEmpty(v)));
}

export interface AdvancedFiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: AdvancedFilterField[];
  /** Currently applied values (from the URL). */
  values: FilterValues;
  onApply: (values: FilterValues) => void;
  /** Live "Show N results": total for the draft values. */
  countFn?: (values: FilterValues) => Promise<number>;
  countKey?: readonly unknown[];
  onSaveView?: (values: FilterValues) => void;
  itemLabel?: string;
}

export function AdvancedFiltersDrawer(props: AdvancedFiltersDrawerProps) {
  const { open, onOpenChange } = props;
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {open && <DrawerBody {...props} />}
    </DialogRoot>
  );
}

function DrawerBody({
  fields,
  values,
  onApply,
  onOpenChange,
  countFn,
  countKey = ["advanced-count"],
  onSaveView,
  itemLabel,
}: AdvancedFiltersDrawerProps) {
  const t = useTranslations("filters");
  const [draft, setDraft] = useState<FilterValues>(() => cleanValues(values));
  const [debounced, setDebounced] = useState(draft);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(draft), 250);
    return () => clearTimeout(id);
  }, [draft]);

  const count = useQuery({
    queryKey: [...countKey, debounced],
    queryFn: () => countFn!(debounced),
    enabled: !!countFn,
    placeholderData: keepPreviousData,
  });

  const setValue = (key: string, v: string | string[] | null) =>
    setDraft((d) => cleanValues({ ...d, [key]: v ?? "" }));

  const configs = advancedToFilterConfigs(fields, { yes: t("yes"), any: t("any") });

  const showLabel =
    countFn && count.data !== undefined
      ? t("showN", { count: count.data, item: itemLabel ?? t("results") })
      : t("showResults");

  return (
    <DrawerContent
      title={t("title")}
      description={t("description")}
      width={500}
      footer={
        <>
          {onSaveView && (
            <Button
              variant="secondary"
              icon={<Bookmark />}
              onClick={() => onSaveView(draft)}
              className="me-auto"
            >
              {t("saveAsView")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-brand"
            onClick={() => setDraft({})}
            disabled={Object.keys(draft).length === 0}
          >
            {t("clearAll")}
          </Button>
          <Button
            loading={count.isFetching && count.data === undefined}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            {showLabel}
          </Button>
        </>
      }
    >
      <div className="-mx-4 -mt-2 mb-2">
        <FilterChips
          filters={configs}
          values={draft}
          onRemove={(k) => setValue(k, null)}
          onClearAll={() => setDraft({})}
        />
      </div>
      <div className="flex flex-col gap-5">
        {fields.map((f) => (
          <fieldset key={f.key} className="min-w-0">
            <legend className="mb-2 text-11 font-medium tracking-wide text-muted uppercase">{f.label}</legend>
            <FieldControl
              field={f}
              value={draft[f.key]}
              onChange={(v) => setValue(f.key, v)}
              anyLabel={t("any")}
            />
            {f.hint && <p className="mt-1.5 text-12 text-muted">{f.hint}</p>}
          </fieldset>
        ))}
      </div>
    </DrawerContent>
  );
}

function ChipToggle({
  on,
  onClick,
  children,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-13 transition-colors",
        on
          ? "border-brand/30 bg-brand-soft font-medium text-brand"
          : "border-border bg-surface text-ink hover:bg-canvas",
      )}
    >
      {on && <Check className="size-3.5" aria-hidden />}
      {children}
      {hint !== undefined && (
        <span className={cn("text-12", on ? "text-brand/70" : "text-faint")}>{hint}</span>
      )}
    </button>
  );
}

function FieldControl({
  field: f,
  value,
  onChange,
  anyLabel,
}: {
  field: AdvancedFilterField;
  value: string | string[] | undefined;
  onChange: (v: string | string[] | null) => void;
  anyLabel: string;
}) {
  const t = useTranslations("filters");
  switch (f.type) {
    case "select":
      return (
        <Select
          aria-label={f.label}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          options={f.options}
          placeholder={anyLabel}
        />
      );
    case "multiselect": {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      if (f.display === "dropdown") {
        return <MultiSelect aria-label={f.label} value={list} onValueChange={onChange} options={f.options} />;
      }
      return (
        <div role="group" aria-label={f.label} className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <ChipToggle
              key={o.value}
              on={list.includes(o.value)}
              hint={o.hint}
              onClick={() =>
                onChange(list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value])
              }
            >
              {o.label}
            </ChipToggle>
          ))}
        </div>
      );
    }
    case "segmented":
      return (
        <SegmentedControl
          aria-label={f.label}
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v || null)}
          options={[{ value: "", label: anyLabel }, ...f.options]}
        />
      );
    case "toggle":
      return (
        <Toggle
          label={f.toggleLabel ?? f.label}
          checked={value === "true"}
          onCheckedChange={(c) => onChange(c ? "true" : null)}
        />
      );
    case "range": {
      const { from, to } = parseRange(value);
      const num = (s: string) => (s === "" ? null : Number(s));
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <NumberInput
              aria-label={t("min", { label: f.label })}
              placeholder={t("noMin")}
              suffix={f.suffix}
              value={num(from)}
              onValueChange={(n) => onChange(formatRange(n === null ? "" : String(n), to))}
            />
          </div>
          <span className="text-13 text-muted">{t("to")}</span>
          <div className="flex-1">
            <NumberInput
              aria-label={t("max", { label: f.label })}
              placeholder={t("noLimit")}
              suffix={f.suffix}
              value={num(to)}
              onValueChange={(n) => onChange(formatRange(from, n === null ? "" : String(n)))}
            />
          </div>
        </div>
      );
    }
    case "daterange": {
      const r = parseRange(value);
      return (
        <DateRangeInput
          aria-label={f.label}
          value={r}
          onValueChange={(v) => onChange(formatRange(v.from, v.to))}
        />
      );
    }
  }
}
