"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";
import { getAvailability, serviceKeys, type DayStatus } from "@/lib/api/services";
import { cn } from "@/lib/utils/cn";
import { intlLocale } from "@/lib/utils/format";
import { monthGrid, monthKey } from "../services/[id]/availability-calendar";

/** Days the provider can't take another event on (the API still allows "Book anyway"). */
export const BUSY_STATUSES: DayStatus[] = ["booked", "blocked"];

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/**
 * Month grid of a provider's availability used to pick an event date (BKG-05, create booking).
 * `current` is outlined (amber), the selection is filled; busy days are grey but still selectable.
 */
export function AvailabilityPicker({
  providerId,
  providerName,
  value,
  current,
  onChange,
  minDate,
}: {
  providerId: string | null;
  providerName?: string;
  value: string;
  current?: string;
  onChange: (date: string, status: DayStatus) => void;
  minDate?: string;
}) {
  const t = useTranslations("bookings.picker");
  const ta = useTranslations("services.availability");
  const locale = useLocale();
  const [month, setMonth] = useState(() => (value || current || monthKey(new Date())).slice(0, 7));
  const query = useQuery({
    queryKey: serviceKeys.availability(providerId ?? "none", month),
    queryFn: () => getAvailability(providerId!, month),
    enabled: !!providerId,
  });
  const [y, m] = month.split("-").map(Number);
  const title = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(new Date(2026, 8, 5 + i)),
  );
  const cells = monthGrid(month, query.data?.days ?? []);
  const min = minDate ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton label={ta("previous")} size="sm" onClick={() => setMonth(shift(month, -1))}>
          <ChevronLeft className="flip-rtl" />
        </IconButton>
        <span className="text-13 font-medium text-ink">
          {providerName ? t("title", { month: title, provider: providerName }) : title}
        </span>
        <IconButton label={ta("next")} size="sm" onClick={() => setMonth(shift(month, 1))}>
          <ChevronRight className="flip-rtl" />
        </IconButton>
      </div>
      <div
        role="grid"
        aria-label={title}
        aria-busy={query.isFetching || undefined}
        className="grid grid-cols-7 gap-1 text-center"
      >
        {weekdays.map((w) => (
          <div key={w} role="columnheader" className="py-1 text-11 text-muted">
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`b${i}`} aria-hidden />;
          const past = c.date < min;
          const busy = BUSY_STATUSES.includes(c.status);
          const selected = c.date === value;
          const isCurrent = c.date === current;
          return (
            <button
              key={c.date}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={`${c.date} · ${ta(`status.${c.status}`)}${isCurrent ? ` · ${t("current")}` : ""}`}
              data-status={c.status}
              disabled={past}
              onClick={() => onChange(c.date, c.status)}
              className={cn(
                "h-8 rounded-md text-13 tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-faint",
                selected
                  ? "bg-brand font-semibold text-white"
                  : isCurrent
                    ? "border border-amber/50 bg-amber-soft text-ink"
                    : busy
                      ? "bg-gray-soft text-muted"
                      : c.status === "held" || c.status === "partial"
                        ? "bg-blue-soft text-blue"
                        : "text-ink hover:bg-canvas",
              )}
            >
              {Number(c.date.slice(8))}
            </button>
          );
        })}
      </div>
      {!providerId && <p className="mt-2 text-12 text-muted">{t("pickOfferFirst")}</p>}
    </div>
  );
}
