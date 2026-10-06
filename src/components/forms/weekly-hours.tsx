"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, IconButton } from "@/components/ui/button";
import { Toggle } from "@/components/forms/fields";
import { TimeSelect } from "./inputs";

export interface WeeklyHour {
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  startTime: string;
  endTime: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Bookable hours per weekday (issues 3 #6). A day without ranges is closed; an empty
 * value means "any time" and is the caller's switch. An end at or before the start
 * runs past midnight (20:00 → 02:00), which the hint spells out.
 */
export function WeeklyHoursEditor({
  value,
  onValueChange,
  error,
}: {
  value: WeeklyHour[];
  onValueChange: (value: WeeklyHour[]) => void;
  error?: string;
}) {
  const t = useTranslations("weeklyHours");

  const ranges = (weekday: number) =>
    value.map((h, index) => ({ ...h, index })).filter((h) => h.weekday === weekday);
  const update = (index: number, patch: Partial<WeeklyHour>) =>
    onValueChange(value.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  const remove = (index: number) => onValueChange(value.filter((_, i) => i !== index));
  const add = (weekday: number) => {
    const last = ranges(weekday).at(-1);
    onValueChange([...value, { weekday, startTime: last ? last.endTime : "09:00", endTime: last ? "23:00" : "18:00" }]);
  };
  const setOpen = (weekday: number, open: boolean) =>
    open ? add(weekday) : onValueChange(value.filter((h) => h.weekday !== weekday));

  return (
    <div className="flex flex-col gap-2" data-testid="weekly-hours">
      {WEEKDAYS.map((weekday) => {
        const day = ranges(weekday);
        const label = t(`days.${weekday}`);
        return (
          <div key={weekday} className="flex flex-wrap items-start gap-3 border-b border-border pb-2 last:border-0">
            <div className="w-36 shrink-0 pt-2">
              <Toggle checked={day.length > 0} onCheckedChange={(c) => setOpen(weekday, c)} label={label} />
            </div>
            {day.length === 0 ? (
              <span className="pt-2 text-13 text-muted">{t("closed")}</span>
            ) : (
              <div className="flex flex-1 flex-col gap-2">
                {day.map((h) => (
                  <div key={h.index} className="flex items-center gap-2">
                    <div className="w-28">
                      <TimeSelect
                        aria-label={t("from", { day: label })}
                        value={h.startTime}
                        onValueChange={(startTime) => update(h.index, { startTime })}
                      />
                    </div>
                    <span className="text-13 text-muted">–</span>
                    <div className="w-28">
                      <TimeSelect
                        aria-label={t("to", { day: label })}
                        value={h.endTime}
                        onValueChange={(endTime) => update(h.index, { endTime })}
                      />
                    </div>
                    {h.endTime <= h.startTime && <span className="text-12 text-muted">{t("nextDay")}</span>}
                    <IconButton label={t("removeRange")} variant="ghost" onClick={() => remove(h.index)}>
                      <X />
                    </IconButton>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="ghost" icon={<Plus />} onClick={() => add(weekday)}>
                    {t("addRange")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-12 text-red">{error}</p>}
    </div>
  );
}
