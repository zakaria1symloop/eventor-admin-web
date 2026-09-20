"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { toneClasses, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ StackedBarChart (OVR-01 bookings per day) */

export interface StackedBarDatum {
  key: string;
  /** Axis label (shown for a few evenly spaced bars). */
  label: string;
  /** Segments bottom → top. */
  values: number[];
  /** Accessible / hover text. */
  title: string;
}

/** A "nice" axis maximum with 3 whole steps: 3, 6, 15, 30, 60, 150… (never below 3). */
export function niceMax(value: number): number {
  const raw = Math.max(value, 1) / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const step of [1, 2, 5, 10]) {
    if (step * pow >= raw) return Math.max(3, Math.ceil(step * pow) * 3);
  }
  return 30 * pow;
}

/**
 * Responsive stacked bars (HTML + CSS) with a 4-step Y axis. `segmentClasses` are Tailwind `bg-*` classes,
 * bottom segment first.
 */
export function StackedBarChart({
  data,
  segmentClasses,
  height = 200,
  labelEvery,
  ariaLabel,
  className,
}: {
  data: StackedBarDatum[];
  segmentClasses: string[];
  height?: number;
  labelEvery?: number;
  ariaLabel: string;
  className?: string;
}) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.values.reduce((a, b) => a + b, 0))));
  const ticks = [3, 2, 1, 0].map((i) => (max / 3) * i);
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 5));
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <figure role="img" aria-label={ariaLabel} className={cn("flex gap-2", className)}>
      <div
        aria-hidden
        className="flex flex-col justify-between pb-6 text-end text-11 text-faint tabular-nums"
        style={{ height }}
      >
        {ticks.map((tick) => (
          <span key={tick} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
            {fmt(tick)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: height - 24 }}>
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick) => (
              <span key={tick} className="block border-t border-dashed border-border" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-1">
            {data.map((d) => (
              <div
                key={d.key}
                title={d.title}
                data-testid="chart-bar"
                className="flex h-full min-w-0 flex-1 flex-col-reverse items-center"
              >
                {d.values.map((v, si) => (
                  <span
                    key={si}
                    className={cn(
                      "block w-full max-w-[18px] shrink-0",
                      si === d.values.length - 1 && "rounded-t-[2px]",
                      segmentClasses[si],
                    )}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden className="flex h-6 items-end gap-[2px] text-11 text-faint sm:gap-1">
          {data.map((d, i) => (
            <span key={d.key} className="relative flex-1">
              {(i % every === 0 || i === data.length - 1) &&
                (i === data.length - 1 || data.length - 1 - i >= every / 2) && (
                  <span className="absolute start-1/2 bottom-0 whitespace-nowrap ltr:-translate-x-1/2 rtl:translate-x-1/2">
                    {d.label}
                  </span>
                )}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function ChartLegend({ items }: { items: { label: ReactNode; className: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4 text-12 text-ink-2">
      {items.map((it, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-[3px]", it.className)} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ StatBarList (OVR-01 bookings by status) */

export interface StatBarItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
  percent: number;
  /** Tailwind bg class of the bar. */
  barClass: string;
  href?: string;
}

export function StatBarList({ items }: { items: StatBarItem[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((it) => {
        const body = (
          <>
            <div className="flex items-baseline gap-2 text-13">
              <span className="flex-1 text-ink">{it.label}</span>
              <span className="font-semibold text-ink tabular-nums">{it.value}</span>
              <span className="w-11 text-end text-12 text-faint tabular-nums">{it.percent.toFixed(1)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-gray-soft">
              <div
                className={cn("h-full min-w-1.5 rounded-pill", it.barClass)}
                style={{ width: `${Math.max(0, Math.min(100, it.percent))}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className="block rounded-sm hover:opacity-80">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ KpiTile */

export function KpiTile({
  label,
  value,
  delta,
  deltaLabel,
  tone = "brand",
  href,
  invert,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Percent change; null hides the delta. */
  delta: number | null;
  deltaLabel?: ReactNode;
  tone?: Tone;
  href?: string;
  /** A drop is good news (not used by V1 KPIs). */
  invert?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  const good = invert ? !up : up;
  const body = (
    <>
      <span className="flex items-center gap-2 text-13 text-ink-2">
        <span aria-hidden className={cn("size-2 rounded-full", toneClasses[tone].dot)} />
        {label}
      </span>
      <span className="mt-1 block text-26 font-semibold text-ink tabular-nums">{value}</span>
      {delta !== null ? (
        <span className={cn("mt-0.5 flex items-center gap-1 text-12", good ? "text-green" : "text-red")}>
          {up ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
          <span className="tabular-nums" dir="ltr">
            {Math.abs(delta).toFixed(Math.abs(delta) < 10 && delta % 1 !== 0 ? 1 : 0)}%
          </span>
          {deltaLabel && <span>{deltaLabel}</span>}
        </span>
      ) : (
        <span className="mt-0.5 block text-12 text-faint">—</span>
      )}
    </>
  );
  const cls = "block rounded-xl border border-border bg-surface px-4 py-3.5 text-start";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-brand/30")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
