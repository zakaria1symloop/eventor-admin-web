"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";

export interface PriceSummaryLine {
  key: string;
  label: ReactNode;
  amount: string | number;
}

/** Lines, total for the client, platform fee % and what the provider receives (BKG-03, BKG-06, BKG-07). */
export function PriceSummary({
  lines,
  total,
  feePercent,
  feeAmount,
  providerAmount,
  before,
  className,
}: {
  lines?: PriceSummaryLine[];
  total: string | number;
  feePercent: string | number;
  feeAmount: string | number;
  providerAmount: string | number;
  /** Previous total (BKG-06 "Before"). */
  before?: string | number;
  className?: string;
}) {
  const t = useTranslations("domain.price");
  const locale = useLocale();
  const money = (v: string | number) => formatMoney(v, locale).replace(/^-/, "− ");
  const row = (label: ReactNode, value: ReactNode, cls?: string, key?: string) => (
    <div key={key} className={cn("flex items-center justify-between gap-4 px-[18px] py-2.5 text-13", cls)}>
      <dt className="min-w-0 truncate text-ink-2">{label}</dt>
      <dd className="shrink-0 tabular-nums" dir="ltr">
        {value}
      </dd>
    </div>
  );
  return (
    <dl className={cn("flex flex-col", className)} aria-live="polite">
      {lines?.map((l) =>
        row(
          l.label,
          <span className={Number(l.amount) < 0 ? "text-green" : "text-ink"}>{money(l.amount)}</span>,
          undefined,
          l.key,
        ),
      )}
      {before !== undefined &&
        row(t("before"), <span className="font-semibold text-ink">{money(before)}</span>)}
      {row(
        before !== undefined ? (
          <span className="font-semibold text-ink">{t("newTotal")}</span>
        ) : (
          t("totalForClient")
        ),
        <span className="font-semibold text-ink">{money(total)}</span>,
        "bg-canvas",
      )}
      {row(t("fee", { percent: Number(feePercent) }), <span className="text-ink">{money(feeAmount)}</span>)}
      {row(t("providerReceives"), <span className="font-semibold text-ink">{money(providerAmount)}</span>)}
    </dl>
  );
}
