"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { Banner } from "@/components/feedback/banner";
import { ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Checkbox, Field, Textarea } from "@/components/forms/fields";
import { TimeSelect } from "@/components/forms/inputs";
import { Button, IconButton } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  createBlock,
  deleteBlock,
  getAvailability,
  localTitle,
  serviceKeys,
  type AvailabilityDay,
  type DayStatus,
} from "@/lib/api/services";
import { cn } from "@/lib/utils/cn";
import { intlLocale } from "@/lib/utils/format";

const dayTone: Record<DayStatus, string> = {
  free: "text-ink hover:bg-canvas",
  partial: "bg-blue-soft text-blue hover:ring-1 hover:ring-blue/30",
  blocked: "bg-gray-soft text-muted hover:ring-1 hover:ring-border",
  held: "bg-amber-soft text-amber hover:ring-1 hover:ring-amber/30",
  booked: "bg-brand text-white hover:bg-brand/90",
};

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/** Month grid starting on Saturday (Algerian week), padded with blanks. */
export function monthGrid(month: string, days: AvailabilityDay[]): (AvailabilityDay | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 Sun … 6 Sat
  const offset = (first + 1) % 7; // Saturday = 0
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: (AvailabilityDay | null)[] = Array.from({ length: offset }, () => null);
  for (let i = 1; i <= total; i++) {
    const date = `${month}-${String(i).padStart(2, "0")}`;
    cells.push(byDate.get(date) ?? { date, status: "free", items: [] });
  }
  return cells;
}

export function AvailabilityCalendar({
  providerId,
  service,
  compact,
  fullHref,
}: {
  providerId: string;
  service?: { id: string; titleEn: string; titleAr: string };
  compact?: boolean;
  fullHref?: string;
}) {
  const t = useTranslations("services.availability");
  const locale = useLocale();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [openDay, setOpenDay] = useState<AvailabilityDay | null>(null);
  const query = useQuery({
    queryKey: serviceKeys.availability(providerId, month),
    queryFn: () => getAvailability(providerId, month),
  });

  const [y, m] = month.split("-").map(Number);
  const title = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
  // Sat 2026-09-05 … Fri 2026-09-11 → weekday labels
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(new Date(2026, 8, 5 + i)),
  );
  const cells = query.data ? monthGrid(month, query.data.days) : monthGrid(month, []);
  const current = openDay && query.data?.days.find((d) => d.date === openDay.date);

  return (
    <div>
      <div className={cn("flex items-center justify-between gap-2", compact ? "mb-2" : "mb-4")}>
        <h3 className={cn("font-semibold text-ink capitalize", compact ? "text-15" : "text-16")}>{title}</h3>
        <div className="flex items-center gap-1">
          {fullHref && (
            <Link
              href={fullHref}
              className="me-2 inline-flex items-center gap-1 text-13 font-medium text-brand hover:underline"
            >
              {t("fullCalendar")} <ChevronRight className="flip-rtl size-4" aria-hidden />
            </Link>
          )}
          {!compact && (
            <>
              <IconButton
                label={t("previous")}
                variant="outline"
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft className="flip-rtl" />
              </IconButton>
              <Button variant="secondary" size="sm" onClick={() => setMonth(monthKey(new Date()))}>
                {t("today")}
              </Button>
              <IconButton label={t("next")} variant="outline" onClick={() => setMonth(shiftMonth(month, 1))}>
                <ChevronRight className="flip-rtl" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-8" />
      ) : (
        <div
          role="grid"
          aria-label={title}
          aria-busy={query.isPending || undefined}
          className={cn("grid grid-cols-7 text-center", compact ? "gap-1" : "gap-2")}
        >
          {weekdays.map((w) => (
            <div key={w} role="columnheader" className="py-1 text-11 text-muted">
              {w}
            </div>
          ))}
          {cells.map((c, i) =>
            c ? (
              <button
                key={c.date}
                type="button"
                role="gridcell"
                data-status={c.status}
                aria-label={`${c.date} · ${t(`status.${c.status}`)}`}
                onClick={() => setOpenDay(c)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-md text-13 tabular-nums transition-colors",
                  compact ? "h-8" : "h-16 items-start justify-start p-2",
                  query.isPending ? "animate-pulse bg-gray-soft/50 text-faint" : dayTone[c.status],
                )}
              >
                <span className={cn(!compact && "font-medium")}>{Number(c.date.slice(8))}</span>
                {!compact && c.items.length > 0 && (
                  <span className="mt-auto truncate text-11 opacity-90">
                    {t("itemsCount", { count: c.items.length })}
                  </span>
                )}
              </button>
            ) : (
              <span key={`b${i}`} aria-hidden />
            ),
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-12 text-muted">
        {(["booked", "held", "blocked", "partial"] as const).map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-xs", dayTone[s].split(" ")[0])} aria-hidden />
            {t(`status.${s}`)}
          </li>
        ))}
      </ul>

      <DayDialog
        day={current ?? openDay}
        providerId={providerId}
        service={service}
        month={month}
        onOpenChange={(o) => !o && setOpenDay(null)}
      />
      {query.data && !compact && (
        <p className="mt-2 text-12 text-faint">
          {query.data.maxEventsPerDay === null
            ? t("noDailyLimit")
            : t("maxPerDay", { count: query.data.maxEventsPerDay })}
        </p>
      )}
    </div>
  );
}

function DayDialog({
  day,
  providerId,
  service,
  month,
  onOpenChange,
}: {
  day: AvailabilityDay | null;
  providerId: string;
  service?: { id: string; titleEn: string; titleAr: string };
  month: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("services.availability");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [wholeDay, setWholeDay] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [onlyService, setOnlyService] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [lastDate, setLastDate] = useState<string | null>(null);
  if ((day?.date ?? null) !== lastDate) {
    setLastDate(day?.date ?? null);
    setWholeDay(true);
    setOnlyService(false);
    setNote("");
    setError(null);
  }

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: serviceKeys.availability(providerId, month) });
  const add = useMutation({
    mutationFn: () =>
      createBlock(providerId, {
        date: day!.date,
        ...(wholeDay ? {} : { startTime: start, endTime: end }),
        serviceId: onlyService && service ? service.id : undefined,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t("blocked"));
      setNote("");
      setError(null);
      void refresh();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteBlock(id),
    onSuccess: () => {
      toast.success(t("unblocked"));
      void refresh();
    },
    onError: (e) => toast.apiError(e),
  });

  const label = day
    ? new Intl.DateTimeFormat(intlLocale(locale), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${day.date}T12:00:00`))
    : "";
  const past = day ? day.date < new Date().toISOString().slice(0, 10) : false;

  return (
    <DialogRoot open={!!day} onOpenChange={onOpenChange}>
      <DialogContent
        title={label}
        description={day ? t(`status.${day.status}`) : undefined}
        icon={<Lock />}
        width={500}
        footer={
          <>
            <span className="me-auto" />
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("close")}
            </Button>
            <Button onClick={() => add.mutate()} loading={add.isPending} disabled={past}>
              {t("addBlock")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {day && day.items.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {day.items.map((it, i) => (
                <li key={it.id ?? `${it.kind}-${i}`} className="flex items-center gap-3 px-3 py-2.5 text-13">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-xs", dayTone[it.kind].split(" ")[0])}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">
                      {t(`kind.${it.kind}`)} ·{" "}
                      {it.startTime && it.endTime ? `${it.startTime}–${it.endTime}` : t("wholeDay")}
                    </span>
                    <span className="block truncate text-12 text-muted">
                      {[
                        it.service ? localTitle(it.service, locale) : t("allServices"),
                        it.booking ? `#${it.booking.reference}` : null,
                        it.note,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {it.booking && (
                    <Link
                      href={`/bookings/${it.booking.id}`}
                      className="text-12 font-medium text-brand hover:underline"
                    >
                      {t("openBooking")}
                    </Link>
                  )}
                  {it.removable && it.id && (
                    <IconButton
                      label={t("removeBlock")}
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(it.id!)}
                    >
                      <Trash2 />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-13 text-muted">{t("noItems")}</p>
          )}

          <div className="flex flex-col gap-3 rounded-lg bg-canvas p-3">
            <p className="text-13 font-medium text-ink">{t("blockTitle")}</p>
            {past && <p className="text-12 text-amber">{t("pastDate")}</p>}
            {error && <Banner tone="red" title={error} />}
            <Checkbox label={t("wholeDay")} checked={wholeDay} onCheckedChange={setWholeDay} />
            {!wholeDay && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("from")}>
                  <TimeSelect value={start} onValueChange={setStart} />
                </Field>
                <Field label={t("to")}>
                  <TimeSelect value={end} onValueChange={setEnd} />
                </Field>
              </div>
            )}
            {service && (
              <Checkbox
                label={t("onlyThisService", { title: localTitle(service, locale) })}
                checked={onlyService}
                onCheckedChange={setOnlyService}
              />
            )}
            <Field label={t("note")}>
              <Textarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
