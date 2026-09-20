"use client";

import { CheckCircle2, ExternalLink, Flag, Scale, ShieldCheck, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  DataList,
  type AdvancedFilterField,
  type DataColumn,
  type FilterConfig,
  type ListParams,
} from "@/components/data-list";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { EmptyState } from "@/components/feedback/states";
import type { ActionMenuItem } from "@/components/ui/action-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import {
  dashboardHref,
  listReports,
  REPORT_REASONS,
  REPORT_TABS,
  REPORT_TARGET_TYPES,
  reportKeys,
  reportsQuery,
  type ReportList,
  type ReportRow,
} from "@/lib/api/reviews";
import { savedViewsSource } from "@/lib/api/saved-views";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { ConvertReportDialog, ReportDecisionDialog } from "./review-dialogs";

export const isConvertible = (r: ReportRow) =>
  r.status === "open" && (r.targetType === "review" || r.targetType === "message") && !!r.target.bookingId;

/** Reports queue (`/reviews?view=reports`): every report, resolve / dismiss / convert to dispute. */
export function ReportsList({
  onOpenReview,
  exportOpen,
  onExportOpenChange,
}: {
  onOpenReview: (reviewId: string) => void;
  exportOpen: boolean;
  onExportOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reviews.reportsQueue");
  const tr = useTranslations("reviews");
  const locale = useLocale();
  const [action, setAction] = useState<{ id: string; mode: "resolve" | "dismiss" } | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [params, setParams] = useState<ListParams | null>(null);
  const [total, setTotal] = useState(0);

  const filters: FilterConfig[] = [
    {
      key: "targetType",
      label: t("filters.target"),
      multiple: true,
      options: REPORT_TARGET_TYPES.map((k) => ({ value: k, label: t(`targets.${k}`) })),
    },
    {
      key: "reason",
      label: t("filters.reason"),
      multiple: true,
      options: REPORT_REASONS.map((k) => ({ value: k, label: tr(`reasons.${k}`) })),
    },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    { key: "created", label: t("filters.created"), type: "daterange" },
  ];

  const openTarget = (r: ReportRow) => {
    if (r.target.reviewId) onOpenReview(r.target.reviewId);
  };

  const columns: DataColumn<ReportRow>[] = [
    {
      id: "target",
      header: t("columns.target"),
      hideable: false,
      cell: (r) => {
        const href = r.target.reviewId ? null : dashboardHref(r.target.href);
        return (
          <div className="max-w-[340px] min-w-[200px] leading-tight">
            {r.target.reviewId ? (
              <button
                type="button"
                onClick={() => openTarget(r)}
                className="block truncate text-start text-14 font-medium text-brand hover:underline"
              >
                {r.target.label}
              </button>
            ) : href ? (
              <Link href={href} className="block truncate text-14 font-medium text-brand hover:underline">
                {r.target.label}
              </Link>
            ) : (
              <span className="block truncate text-14 text-muted">{r.target.label}</span>
            )}
            <span className="block text-12 text-muted">
              {[
                t(`targets.${r.targetType}`),
                r.target.bookingReference ? `#${r.target.bookingReference}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        );
      },
    },
    {
      id: "reason",
      header: t("columns.reason"),
      cell: (r) => (
        <div className="max-w-[260px] leading-tight">
          <span className="block text-13 font-medium text-ink">{tr(`reasons.${r.reason}`)}</span>
          {r.note && <span className="block truncate text-12 text-muted">“{r.note}”</span>}
        </div>
      ),
    },
    {
      id: "reporter",
      header: t("columns.reporter"),
      cell: (r) =>
        r.reporter ? (
          <Link href={`/users/${r.reporter.id}`} className="text-13 font-medium text-brand hover:underline">
            {r.reporter.fullName}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-13 text-muted">
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("automatic")}
          </span>
        ),
    },
    {
      id: "createdAt",
      header: t("columns.created"),
      sortable: true,
      cell: (r) => (
        <span className="text-13 whitespace-nowrap text-ink-2">{formatDate(r.createdAt, locale)}</span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (r) => (
        <div className="leading-tight">
          <StatusBadge domain="report" status={r.status} />
          {r.disputeId && (
            <Link
              href={`/disputes/${r.disputeId}`}
              className="mt-1 block text-12 font-medium text-brand hover:underline"
            >
              {r.disputeReference ?? t("dispute")}
            </Link>
          )}
          {!r.disputeId && r.resolutionNote && (
            <span className="mt-1 block max-w-[200px] truncate text-12 text-muted">{r.resolutionNote}</span>
          )}
        </div>
      ),
    },
  ];

  const rowMenu = (r: ReportRow): ActionMenuItem[][] => {
    const open = r.status === "open";
    const href = dashboardHref(r.target.href);
    return [
      [
        r.target.reviewId
          ? { icon: <ExternalLink />, label: t("menu.openTarget"), onSelect: () => openTarget(r) }
          : { icon: <ExternalLink />, label: t("menu.openTarget"), href: href ?? undefined, disabled: !href },
      ],
      [
        {
          icon: <CheckCircle2 />,
          label: t("menu.resolve"),
          disabled: !open,
          onSelect: () => setAction({ id: r.id, mode: "resolve" }),
        },
        {
          icon: <XCircle />,
          label: t("menu.dismiss"),
          disabled: !open,
          onSelect: () => setAction({ id: r.id, mode: "dismiss" }),
        },
        {
          icon: <Scale />,
          label: t("menu.convert"),
          disabled: !isConvertible(r),
          onSelect: () => setConverting(r.id),
        },
      ],
    ];
  };

  return (
    <>
      <DataList<ReportRow>
        resource={reportKeys.all}
        queryFn={async (p) => {
          const res = await listReports(reportsQuery(p));
          setTotal(res.meta.total);
          return res;
        }}
        columns={columns}
        getRowId={(r) => r.id}
        tabs={REPORT_TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
        tabCounts={(res) => (res as ReportList).meta.counts as unknown as Record<string, number>}
        defaultTab="open"
        filters={filters}
        advancedFilters={advancedFilters}
        sortOptions={[
          { value: "createdAt:asc", label: t("sort.oldest") },
          { value: "createdAt:desc", label: t("sort.newest") },
        ]}
        savedViews={savedViewsSource("reports")}
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(r) => openTarget(r)}
        rowMenuHeader={(r) => ({ title: tr(`reasons.${r.reason}`), subtitle: r.target.label })}
        rowMenu={rowMenu}
        emptyState={
          <EmptyState
            icon={<Flag />}
            tone="green"
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        }
      />
      <ReportDecisionDialog
        reportId={action?.id ?? null}
        mode={action?.mode ?? "dismiss"}
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
      />
      <ConvertReportDialog
        reportId={converting}
        open={!!converting}
        onOpenChange={(o) => !o && setConverting(null)}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={onExportOpenChange}
        resource="reports"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(total, locale),
          tab: t(`tabs.${(params?.tab as (typeof REPORT_TABS)[number]) || "open"}`),
        })}
        columns={[
          { key: "target", label: t("columns.target") },
          { key: "targetType", label: t("filters.target") },
          { key: "reason", label: t("columns.reason") },
          { key: "note", label: t("exportNote") },
          { key: "reporter", label: t("columns.reporter") },
          { key: "status", label: t("columns.status") },
          { key: "createdAt", label: t("columns.created") },
        ]}
      />
    </>
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = reportsQuery({ ...p, tab: p.tab || "open" });
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
