"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Briefcase, Loader2, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DragHandleCell } from "@/components/data-list/cells-extended";
import { Checkbox } from "@/components/forms/fields";
import { IconButton } from "@/components/ui/button";
import { listServices, localTitle, serviceKeys } from "@/lib/api/services";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";

export interface PickedService {
  id: string;
  titleEn: string;
  titleAr: string;
  price: string;
  coverUrl: string | null;
  /** Shown when the item is no longer a published service (edit of a pack needing attention). */
  unavailable?: boolean;
}

export const PACK_MIN_ITEMS = 2;
export const PACK_MAX_ITEMS = 6;

/** Published services of one provider (`GET /admin/services?providerId=&tab=published`). */
export function providerServicesQuery(providerId: string) {
  return {
    queryKey: [...serviceKeys.all, "pack-picker", providerId] as const,
    queryFn: () => listServices({ providerId, tab: "published", limit: 100, sort: "title:asc" }),
  };
}

/** PCK-03: pick 2–6 of the provider's published services, drag (or arrow buttons) to order. */
export function ServicePicker({
  providerId,
  value,
  onChange,
  error,
  providerName,
}: {
  providerId: string | null;
  value: PickedService[];
  onChange: (items: PickedService[]) => void;
  error?: string;
  providerName?: string;
}) {
  const t = useTranslations("packs.picker");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const query = useQuery({
    ...providerServicesQuery(providerId ?? ""),
    enabled: !!providerId,
    staleTime: 30_000,
  });

  if (!providerId) return <p className="text-13 text-muted">{t("pickProviderFirst")}</p>;

  const selected = new Set(value.map((v) => v.id));
  const full = value.length >= PACK_MAX_ITEMS;
  const needle = q.trim().toLowerCase();
  const options = (query.data?.data ?? []).filter(
    (s) => !needle || s.titleEn.toLowerCase().includes(needle) || s.titleAr.includes(q.trim()),
  );

  const toggle = (s: (typeof options)[number]) => {
    if (selected.has(s.id)) onChange(value.filter((v) => v.id !== s.id));
    else if (!full)
      onChange([
        ...value,
        { id: s.id, titleEn: s.titleEn, titleAr: s.titleAr, price: s.basePrice, coverUrl: s.coverUrl },
      ]);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-12">
        <span className="text-muted">{t("hint", { provider: providerName ?? "" })}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            value.length < PACK_MIN_ITEMS ? "text-amber" : "text-ink-2",
          )}
          aria-live="polite"
        >
          {t("count", { count: value.length, max: PACK_MAX_ITEMS })}
        </span>
      </div>

      <label className="relative block">
        <span className="sr-only">{t("search")}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="h-9 w-full rounded-md border border-border bg-surface ps-9 pe-3 text-14 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </label>

      <div
        className="max-h-64 overflow-y-auto rounded-lg border border-border"
        aria-busy={query.isFetching || undefined}
      >
        {query.isPending ? (
          <p className="flex items-center gap-2 px-3 py-3 text-13 text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("loading")}
          </p>
        ) : query.isError ? (
          <p className="px-3 py-3 text-13 text-red">{t("loadFailed")}</p>
        ) : options.length === 0 ? (
          <p className="px-3 py-3 text-13 text-muted">{needle ? t("noMatch") : t("noPublished")}</p>
        ) : (
          <ul
            role="listbox"
            aria-multiselectable
            aria-label={t("available")}
            className="divide-y divide-border"
          >
            {options.map((s) => {
              const on = selected.has(s.id);
              return (
                <li key={s.id} className={cn("px-3 py-2", on && "bg-brand-soft/60")}>
                  <Checkbox
                    checked={on}
                    disabled={!on && full}
                    onCheckedChange={() => toggle(s)}
                    label={localTitle(s, locale)}
                    description={formatMoney(s.basePrice, locale)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {full && <p className="text-12 text-amber">{t("maxReached", { max: PACK_MAX_ITEMS })}</p>}

      {value.length > 0 && (
        <ol aria-label={t("selected")} className="flex flex-col gap-2">
          {value.map((v, i) => (
            <li
              key={v.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-2",
                dragIndex === i && "opacity-50",
                v.unavailable && "border-red/40 bg-red-soft/40",
              )}
            >
              <DragHandleCell label={t("drag")} />
              {v.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.coverUrl} alt="" className="size-8 shrink-0 rounded-sm object-cover" />
              ) : (
                <Briefcase className="size-4 text-brand" aria-hidden />
              )}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-13 font-medium text-ink">{localTitle(v, locale)}</span>
                <span className={cn("block text-12", v.unavailable ? "text-red" : "text-muted")}>
                  {v.unavailable ? t("unavailable") : formatMoney(v.price, locale)}
                </span>
              </span>
              <IconButton label={t("moveUp")} size="sm" disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp />
              </IconButton>
              <IconButton
                label={t("moveDown")}
                size="sm"
                disabled={i === value.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </IconButton>
              <IconButton
                label={t("remove", { title: localTitle(v, locale) })}
                size="sm"
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p role="alert" className="text-12 text-red">
          {error}
        </p>
      )}
    </div>
  );
}
