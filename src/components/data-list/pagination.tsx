"use client";

import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { PAGE_SIZES } from "./use-list-state";

export function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  itemLabel?: string;
}

export function Pagination({ page, limit, total, onPageChange, onLimitChange, itemLabel }: PaginationProps) {
  const t = useTranslations("dataList");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "en-US");
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  const navBtn =
    "flex size-8 items-center justify-center rounded-md border border-border bg-surface text-ink-2 hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 text-13 text-ink-2">
      <label className="flex items-center gap-2.5">
        <span>{t("rowsPerPage")}</span>
        <span className="relative">
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-8 appearance-none rounded-md border border-border bg-surface ps-2.5 pe-7 text-13 font-medium text-ink"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-muted"
          />
        </span>
      </label>
      <span aria-live="polite">
        {t("range", { from: nf.format(from), to: nf.format(to), total: nf.format(total) })}
        {itemLabel ? ` ${itemLabel}` : ""}
      </span>

      <nav aria-label="Pagination" className="ms-auto flex items-center gap-1.5">
        <button
          type="button"
          className={navBtn}
          aria-label={t("previousPage")}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden className="flip-rtl size-4" />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} aria-hidden className="w-6 text-center text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={t("page", { page: p })}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-13 tabular-nums",
                p === page ? "bg-brand font-medium text-white" : "text-ink hover:bg-canvas",
              )}
            >
              {nf.format(p)}
            </button>
          ),
        )}
        <button
          type="button"
          className={navBtn}
          aria-label={t("nextPage")}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden className="flip-rtl size-4" />
        </button>
      </nav>
    </div>
  );
}
