"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  FileText,
  GraduationCap,
  Pencil,
  Star,
  Store,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ChartLegend, KpiTile, StackedBarChart, StatBarList } from "@/components/domain/charts";
import { ErrorState } from "@/components/feedback/states";
import { DateRangePopover } from "@/components/forms/date-range-popover";
import { PageHeader } from "@/components/layout/page-header";
import { Pill, toneClasses, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import type { BookingStatus } from "@/lib/api/bookings";
import {
  getOverview,
  overviewKeys,
  overviewQuery,
  type Kpi,
  type Overview,
  type OverviewRange,
  type RecentActivity,
} from "@/lib/api/overview";
import { dashboardHref } from "@/lib/api/reviews";
import { useSession } from "@/lib/auth/use-session";
import { AUTH_ENABLED } from "@/components/layout/auth-guard";
import { cn } from "@/lib/utils/cn";
import { formatCompactMoney, formatMoney, formatNumber, intlLocale } from "@/lib/utils/format";
import { useActionLabel } from "../activity-log/action-label";

const RANGE_PRESETS: OverviewRange[] = ["today", "7d", "30d", "this_month", "custom"];

const STATUS_BAR: Record<BookingStatus, string> = {
  completed: "bg-blue",
  accepted: "bg-green",
  declined: "bg-red",
  cancelled: "bg-muted",
  pending: "bg-amber",
};

const KPI_TONE: Record<Kpi["key"], Tone> = {
  bookings: "brand",
  booking_value: "green",
  new_users: "blue",
  average_rating: "gold",
};

/** CSV of the figures on screen (no overview export resource on the API). */
export function overviewCsv(
  o: Overview,
  labels: { kpi: (k: Kpi["key"]) => string; status: (s: string) => string },
) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(["period", o.period.from, o.period.to].map(esc).join(","));
  lines.push(["previous period", o.previousPeriod.from, o.previousPeriod.to].map(esc).join(","));
  lines.push("");
  lines.push("kpi,value,previous value,delta %");
  for (const k of o.kpis)
    lines.push([labels.kpi(k.key), k.value, k.previousValue, k.deltaPercent].map(esc).join(","));
  lines.push("");
  lines.push("date,requests,completed");
  for (const d of o.bookingsPerDay) lines.push([d.date, d.requests, d.completed].map(esc).join(","));
  lines.push("");
  lines.push("status,count,percent");
  for (const s of o.bookingsByStatus)
    lines.push([labels.status(s.status), s.count, s.percent].map(esc).join(","));
  return lines.join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function activityVisual(a: RecentActivity): { icon: LucideIcon; tone: Tone } {
  const act = a.action;
  if (/block|delete|removed|reject|hidden|hide/.test(act)) return { icon: Ban, tone: "red" };
  if (/approve|verified|resolve|accept|complete/.test(act)) return { icon: Check, tone: "green" };
  switch (a.objectType) {
    case "booking":
    case "invoice":
      return { icon: CalendarDays, tone: "brand" };
    case "review":
      return { icon: Star, tone: "gold" };
    case "academic_request":
    case "form":
      return { icon: GraduationCap, tone: "gold" };
    case "dispute":
      return { icon: TriangleAlert, tone: "amber" };
    case "user":
    case "provider":
    case "admin":
      return { icon: User, tone: "blue" };
    case "service":
    case "pack":
      return { icon: Store, tone: "brand" };
    default:
      return { icon: Pencil, tone: "gray" };
  }
}

export function OverviewScreen() {
  const t = useTranslations("overview");
  const tp = useTranslations("pages.overview");
  const tStatus = useTranslations("status.booking");
  const locale = useLocale();
  const actionLabel = useActionLabel();
  const session = useSession({ enabled: AUTH_ENABLED });
  const [url, setUrl] = useQueryStates(
    { range: parseAsString, from: parseAsString, to: parseAsString },
    { history: "replace" },
  );
  const query = overviewQuery(url.range, url.from, url.to);
  const range = query.range as OverviewRange;
  const overview = useQuery({
    queryKey: overviewKeys.detail(query),
    queryFn: () => getOverview(query),
    refetchInterval: 60_000,
  });
  const o = overview.data;

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Algiers" }).format(
      now,
    ),
  );
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = session.data?.fullName.split(/\s+/)[0];
  const today = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const shortDate = (d: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const rangeLabel =
    range === "custom" && url.from && url.to
      ? `${shortDate(url.from)} – ${shortDate(url.to)}`
      : t(`ranges.${range}`);
  const vsLabel = (() => {
    if (!o) return undefined;
    if (range === "today") return t("vs.yesterday");
    if (range === "this_month")
      return t("vs.month", {
        month: new Intl.DateTimeFormat(intlLocale(locale), { month: "long", timeZone: "UTC" }).format(
          new Date(`${o.previousPeriod.from}T00:00:00Z`),
        ),
      });
    return t("vs.previous");
  })();
  const periodRange = o ? `${o.period.from}..${o.period.to}` : "";

  const kpiValue = (k: Kpi) => {
    if (k.value === null) return "—";
    const n = Number(k.value);
    if (k.key === "booking_value") return formatCompactMoney(n, locale);
    if (k.key === "average_rating") return `${n.toFixed(1)} / 5`;
    return formatNumber(n, locale);
  };
  const kpiHref = (k: Kpi) => {
    if (!o) return undefined;
    if (k.key === "new_users") return `/users?joined=${periodRange}`;
    if (k.key === "average_rating") return `/reviews?created=${periodRange}`;
    return `/bookings?tab=all&created=${periodRange}`;
  };

  const attention: {
    key: string;
    icon: ReactNode;
    tone: Tone;
    value: number;
    label: string;
    hint: string;
    link: string;
    href: string;
  }[] = o
    ? [
        {
          key: "verifications",
          icon: <Check />,
          tone: "gold",
          value: o.attention.verificationsWaiting,
          label: t("attention.verifications"),
          hint:
            o.attention.oldestVerificationWaitingHours === null
              ? t("attention.verificationsNone")
              : o.attention.oldestVerificationWaitingHours >= 48
                ? t("attention.oldestDays", {
                    count: Math.floor(o.attention.oldestVerificationWaitingHours / 24),
                  })
                : t("attention.oldestHours", { count: o.attention.oldestVerificationWaitingHours }),
          link: t("attention.openQueue"),
          href: "/verifications?tab=waiting",
        },
        {
          key: "bookings",
          icon: <CalendarDays />,
          tone: "amber",
          value: o.attention.bookingsNoReply,
          label: t("attention.bookings"),
          hint: t("attention.bookingsHint"),
          link: t("attention.viewBookings"),
          href: "/bookings?noReply=true",
        },
        {
          key: "disputes",
          icon: <TriangleAlert />,
          tone: "red",
          value: o.attention.disputesOpen,
          label: t("attention.disputes"),
          hint: t("attention.disputesHint"),
          link: t("attention.viewDisputes"),
          href: "/disputes?tab=open",
        },
        {
          key: "requests",
          icon: <GraduationCap />,
          tone: "brand",
          value: o.attention.academicRequestsPending,
          label: t("attention.requests"),
          hint: t("attention.requestsHint"),
          link: t("attention.reviewRequests"),
          href: "/academic-requests?tab=pending",
        },
        {
          key: "reviews",
          icon: <Star />,
          tone: "red",
          value: o.attention.reviewsReported,
          label: t("attention.reviews"),
          hint: t("attention.reportedHint"),
          link: t("attention.moderate"),
          href: "/reviews?tab=reported",
        },
        {
          key: "services",
          icon: <Store />,
          tone: "red",
          value: o.attention.servicesReported,
          label: t("attention.services"),
          hint: t("attention.reportedHint"),
          link: t("attention.checkServices"),
          href: "/services?tab=reported",
        },
      ]
    : [];
  const openItems = attention.reduce((sum, a) => sum + a.value, 0);
  const totalBookings = o?.bookingsByStatus.reduce((s, b) => s + b.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tp("title") }]}
        title={firstName ? t(`greeting.${greeting}`, { name: firstName }) : tp("title")}
        subtitle={t("subtitle", { date: today })}
        actions={
          <>
            <DateRangePopover
              presets={RANGE_PRESETS.map((r) => ({ value: r, label: t(`ranges.${r}`) }))}
              value={range}
              range={url.from && url.to ? { from: url.from, to: url.to } : undefined}
              label={rangeLabel}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(preset, r) =>
                void setUrl({
                  range: preset === "30d" ? null : preset,
                  from: preset === "custom" ? (r?.from ?? null) : null,
                  to: preset === "custom" ? (r?.to ?? null) : null,
                })
              }
            />
            <Button
              variant="secondary"
              icon={<FileText />}
              disabled={!o}
              onClick={() => {
                if (!o) return;
                download(
                  `eventor-overview-${o.period.from}_${o.period.to}.csv`,
                  overviewCsv(o, { kpi: (k) => t(`kpis.${k}`), status: (s) => tStatus(s) }),
                );
              }}
            >
              {t("export")}
            </Button>
          </>
        }
      />

      {overview.isError && !o ? (
        <Card>
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        </Card>
      ) : (
        <div className="flex flex-col gap-5" aria-busy={overview.isPending}>
          <Card>
            <CardHeader
              title={t("attention.title")}
              subtitle={t("attention.subtitle")}
              actions={
                o && (
                  <Pill tone={openItems > 0 ? "amber" : "green"}>
                    {t("attention.openItems", { count: openItems })}
                  </Pill>
                )
              }
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {o
                ? attention.map((a) => {
                    const tone = toneClasses[a.tone];
                    return (
                      <Link
                        key={a.key}
                        href={a.href}
                        className="group flex flex-col border-border px-[18px] py-4 hover:bg-canvas max-sm:border-b sm:border-e"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-lg [&_svg]:size-5",
                              tone.soft,
                              tone.text,
                            )}
                          >
                            {a.icon}
                          </span>
                          <span
                            className={cn(
                              "text-26 font-semibold tabular-nums",
                              a.value > 0 ? "text-ink" : "text-faint",
                            )}
                          >
                            {formatNumber(a.value, locale)}
                          </span>
                        </span>
                        <span className="mt-3 text-14 font-medium text-ink">{a.label}</span>
                        <span className="text-12 text-muted">{a.hint}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-13 font-medium text-brand group-hover:underline">
                          {a.link}
                          <ChevronRight aria-hidden className="flip-rtl size-3.5" />
                        </span>
                      </Link>
                    );
                  })
                : Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2 px-[18px] py-4">
                      <span className="size-10 animate-pulse rounded-lg bg-gray-soft" />
                      <span className="h-4 w-2/3 animate-pulse rounded-sm bg-gray-soft" />
                      <span className="h-3 w-1/2 animate-pulse rounded-sm bg-gray-soft" />
                    </div>
                  ))}
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {o
              ? o.kpis.map((k) => (
                  <KpiTile
                    key={k.key}
                    label={t(`kpis.${k.key}`)}
                    value={kpiValue(k)}
                    delta={k.deltaPercent}
                    deltaLabel={vsLabel}
                    tone={KPI_TONE[k.key]}
                    href={kpiHref(k)}
                  />
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[104px] animate-pulse rounded-xl border border-border bg-surface"
                  />
                ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title={t("perDay.title")}
                subtitle={t("perDay.subtitle")}
                actions={
                  <ChartLegend
                    items={[
                      { label: t("perDay.requests"), className: "bg-brand" },
                      { label: t("perDay.completed"), className: "bg-gold" },
                    ]}
                  />
                }
              />
              <div className="px-[18px] py-4">
                {o ? (
                  o.bookingsPerDay.every((d) => d.requests === 0 && d.completed === 0) ? (
                    <p className="flex h-[200px] items-center justify-center text-13 text-muted">
                      {t("perDay.empty")}
                    </p>
                  ) : (
                    <StackedBarChart
                      ariaLabel={t("perDay.title")}
                      segmentClasses={["bg-gold", "bg-brand"]}
                      data={o.bookingsPerDay.map((d) => ({
                        key: d.date,
                        label: shortDate(d.date),
                        values: [d.completed, Math.max(0, d.requests - d.completed)],
                        title: t("perDay.tooltip", {
                          date: shortDate(d.date),
                          requests: d.requests,
                          completed: d.completed,
                        }),
                      }))}
                    />
                  )
                ) : (
                  <div className="h-[200px] animate-pulse rounded-md bg-gray-soft" />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t("byStatus.title")}
                subtitle={
                  o ? t("byStatus.subtitle", { count: formatNumber(totalBookings, locale) }) : undefined
                }
              />
              <div className="px-[18px] py-4">
                {o ? (
                  <StatBarList
                    items={[...o.bookingsByStatus]
                      .sort((a, b) => b.count - a.count)
                      .map((s) => ({
                        key: s.status,
                        label: tStatus(s.status),
                        value: formatNumber(s.count, locale),
                        percent: s.percent,
                        barClass: STATUS_BAR[s.status] ?? "bg-muted",
                        href: `/bookings?tab=${s.status}`,
                      }))}
                  />
                ) : (
                  <div className="h-[200px] animate-pulse rounded-md bg-gray-soft" />
                )}
                <Link
                  href="/bookings?tab=all"
                  className="mt-5 inline-flex items-center gap-1 text-13 font-medium text-brand hover:underline"
                >
                  {t("byStatus.open")}
                  <ChevronRight aria-hidden className="flip-rtl size-3.5" />
                </Link>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader
                title={t("latest.title")}
                subtitle={t("latest.subtitle")}
                action={
                  <Link href="/bookings?tab=all" className="inline-flex items-center gap-1 hover:underline">
                    {t("latest.viewAll")}
                    <ChevronRight aria-hidden className="flip-rtl size-3.5" />
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-start text-13">
                  <thead>
                    <tr className="border-b border-border text-11 tracking-[0.06em] text-muted uppercase">
                      <th className="px-[18px] py-2.5 text-start font-medium">{t("latest.booking")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">{t("latest.client")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">{t("latest.eventDate")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">{t("latest.amount")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">{t("latest.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o ? (
                      o.latestBookings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-[18px] py-8 text-center text-muted">
                            {t("latest.empty")}
                          </td>
                        </tr>
                      ) : (
                        o.latestBookings.map((b) => (
                          <tr key={b.id} className="border-b border-border last:border-b-0 hover:bg-canvas">
                            <td className="px-[18px] py-2.5">
                              <Link
                                href={`/bookings/${b.id}`}
                                className="block font-medium text-ink hover:text-brand"
                              >
                                #{b.reference}
                              </Link>
                              <span className="block max-w-[260px] truncate text-12 text-muted">
                                {locale === "ar" ? b.titleAr || b.titleEn : b.titleEn || b.titleAr}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <Link
                                href={`/users/${b.client.id}`}
                                className="font-medium text-brand hover:underline"
                              >
                                {b.client.fullName}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                              {new Intl.DateTimeFormat(intlLocale(locale), {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                timeZone: "UTC",
                              }).format(new Date(`${b.eventDate}T00:00:00Z`))}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-ink tabular-nums">
                              {formatMoney(b.total, locale)}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge domain="booking" status={b.status} />
                            </td>
                          </tr>
                        ))
                      )
                    ) : (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td colSpan={5} className="px-[18px] py-3">
                            <span className="block h-4 animate-pulse rounded-sm bg-gray-soft" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t("activity.title")}
                subtitle={t("activity.subtitle")}
                action={
                  <Link href="/activity-log" className="inline-flex items-center gap-1 hover:underline">
                    {t("activity.log")}
                    <ChevronRight aria-hidden className="flip-rtl size-3.5" />
                  </Link>
                }
              />
              <ul className="flex flex-col gap-1 px-2 py-3">
                {o ? (
                  o.recentActivity.length === 0 ? (
                    <li className="px-3 py-6 text-center text-13 text-muted">{t("activity.empty")}</li>
                  ) : (
                    o.recentActivity.map((a) => {
                      const v = activityVisual(a);
                      const Icon = v.icon;
                      const tone = toneClasses[v.tone];
                      const when = new Date(a.createdAt);
                      const sameDay = when.toDateString() === now.toDateString();
                      return (
                        <li key={a.id}>
                          <Link
                            href={dashboardHref(a.logHref) ?? `/activity-log?entry=${a.id}`}
                            className="flex items-start gap-3 rounded-md px-2.5 py-2 hover:bg-canvas"
                          >
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-full",
                                tone.soft,
                                tone.text,
                              )}
                            >
                              <Icon aria-hidden className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block text-13 text-ink">
                                <span className="font-medium">
                                  {a.actor?.fullName ?? t("activity.system")}
                                </span>{" "}
                                {actionLabel(a.action).toLowerCase()}
                                {a.objectLabel ? ` · ${a.objectLabel}` : ""}
                              </span>
                              <span className="mt-0.5 block text-11 text-faint">
                                {sameDay
                                  ? new Intl.DateTimeFormat(intlLocale(locale), {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }).format(when)
                                  : new Intl.DateTimeFormat(intlLocale(locale), {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }).format(when)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })
                  )
                ) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 px-2.5 py-2">
                      <span className="size-8 animate-pulse rounded-full bg-gray-soft" />
                      <span className="h-3 flex-1 animate-pulse rounded-sm bg-gray-soft" />
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </div>
          {o && (
            <p className="text-12 text-faint">
              <CircleCheck aria-hidden className="me-1 inline size-3.5" />
              {t("generated", {
                time: new Intl.DateTimeFormat(intlLocale(locale), {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(o.generatedAt)),
              })}
            </p>
          )}
        </div>
      )}
    </>
  );
}
