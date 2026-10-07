"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { DROPDOWN_COLLISION_PADDING, popoverSurface } from "@/components/ui/dropdown";
import { DateRangeInput, type DateRange } from "./inputs";

export interface DateRangePreset {
  value: string;
  label: ReactNode;
}

/**
 * OVR-01 "Last 30 days" — preset list plus a custom range (`custom` preset) in a popover.
 * `onChange(preset, range?)`: the range is set only for the custom preset.
 */
export function DateRangePopover({
  presets,
  value,
  range,
  label,
  onChange,
  customValue = "custom",
  max,
}: {
  presets: DateRangePreset[];
  value: string;
  range?: DateRange;
  /** Trigger text (the selected preset or the custom dates). */
  label: ReactNode;
  onChange: (preset: string, range?: DateRange) => void;
  customValue?: string;
  max?: string;
}) {
  const t = useTranslations("forms");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(range ?? { from: "", to: "" });
  const [custom, setCustom] = useState(value === customValue);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDraft(range ?? { from: "", to: "" });
          setCustom(value === customValue);
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant="secondary"
          icon={<CalendarDays />}
          iconEnd={<ChevronDown className="size-4 text-muted" />}
        >
          {label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={DROPDOWN_COLLISION_PADDING}
          className={cn(popoverSurface, "w-[300px]")}
        >
          <ul role="listbox" aria-label={t("dateRange")}>
            {presets.map((p) => {
              const selected = p.value === customValue ? custom : !custom && value === p.value;
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      if (p.value === customValue) {
                        setCustom(true);
                        return;
                      }
                      setCustom(false);
                      setOpen(false);
                      onChange(p.value);
                    }}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-sm px-2 text-start text-13 hover:bg-canvas",
                      selected ? "font-medium text-brand" : "text-ink",
                    )}
                  >
                    <span className="flex-1">{p.label}</span>
                    {selected && <Check aria-hidden className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {custom && (
            <div className="mt-1 border-t border-border px-2 pt-3 pb-2">
              <DateRangeInput value={draft} onValueChange={setDraft} max={max} aria-label={t("dateRange")} />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  {tc("cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={!draft.from || !draft.to || draft.from > draft.to}
                  onClick={() => {
                    setOpen(false);
                    onChange(customValue, draft);
                  }}
                >
                  {t("apply")}
                </Button>
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
