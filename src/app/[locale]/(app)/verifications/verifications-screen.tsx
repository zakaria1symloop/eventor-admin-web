"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  DataList,
  StackCell,
  StatusBadgeCell,
  UserCell,
  formatRange,
  type AdvancedFilterField,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { EmptyState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { savedViewsSource } from "@/lib/api/saved-views";
import type { DocumentType } from "@/lib/api/users";
import {
  DOCUMENT_TYPES,
  listVerifications,
  verificationKeys,
  verificationsQuery,
  type VerificationList,
  type VerificationRow,
} from "@/lib/api/verifications";
import { formatDate, formatNumber, formatRelative } from "@/lib/utils/format";
import { localName, useUserOptions } from "../users/use-user-options";

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Keeps tab / q / filters / sort when moving between VER-01 and VER-02. */
export function listSearch(p: Pick<ListParams, "q" | "tab" | "sort" | "filters">): string {
  const sp = new URLSearchParams();
  if (p.tab && p.tab !== "waiting") sp.set("tab", p.tab);
  if (p.q) sp.set("q", p.q);
  if (p.sort) sp.set("sort", p.sort);
  for (const [k, v] of Object.entries(p.filters)) sp.set(k, Array.isArray(v) ? v.join(",") : v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function VerificationsScreen() {
  const t = useTranslations("verifications");
  const tu = useTranslations("users");
  const tp = useTranslations("pages.verifications");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const { categoryOptions, wilayaOptions } = useUserOptions();
  const [params, setParams] = useState<ListParams | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const stats = useQuery({
    queryKey: [...verificationKeys.all, "stats"],
    queryFn: () => listVerifications({ tab: "all", limit: 1 }),
  });
  const oldest = useQuery({
    queryKey: [...verificationKeys.all, "stats", "oldest"],
    queryFn: () => listVerifications({ tab: "waiting", limit: 1, sort: "submittedAt:asc" }),
  });
  const counts: Partial<Record<string, number>> = stats.data?.meta.counts ?? {};
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));
  const oldestAt = oldest.data?.data[0]?.submittedAt;
  // Cards switch the tab (a URL key like the filters); the tab row shows the selection.
  const quickFilters: QuickFilterItem[] = [
    {
      key: "waiting",
      label: t("stats.waiting"),
      value: v(counts.waiting),
      hint: oldestAt ? t("stats.oldest", { when: formatRelative(oldestAt, locale) }) : t("stats.waitingHint"),
      tone: "amber",
      filter: { tab: "waiting" },
    },
    {
      key: "resubmitted",
      label: t("stats.resubmitted"),
      value: v(counts.resubmitted),
      hint: t("stats.resubmittedHint"),
      tone: "brand",
      filter: { tab: "resubmitted" },
    },
    {
      key: "approved",
      label: t("stats.approved"),
      value: v(counts.approved),
      hint: t("stats.approvedHint"),
      tone: "green",
      filter: { tab: "approved" },
    },
    {
      key: "rejected",
      label: t("stats.rejected"),
      value: v(counts.rejected),
      hint: t("stats.rejectedHint"),
      tone: "red",
      filter: { tab: "rejected" },
    },
  ];

  const docOptions = DOCUMENT_TYPES.map((d) => ({ value: d, label: tu(`documentTypes.${d}`) }));
  const filters: FilterConfig[] = useMemo(
    () => [
      { key: "categoryId", label: t("filters.category"), options: categoryOptions },
      { key: "documentType", label: t("filters.document"), options: docOptions },
      { key: "wilaya", label: t("filters.wilaya"), options: wilayaOptions, multiple: true },
      {
        key: "submitted",
        label: t("filters.submitted"),
        options: [1, 7, 30].map((d) => ({
          value: formatRange(isoDay(new Date(now - d * DAY)), ""),
          label: t("filters.submittedLast", { count: d }),
        })),
        format: (val) => {
          const [from = "", to = ""] = String(val).split("..");
          return from && to ? `${from} → ${to}` : from ? `≥ ${from}` : `≤ ${to}`;
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryOptions, wilayaOptions, t, now],
  );
  const advancedFilters: AdvancedFilterField[] = [
    { key: "categoryId", label: t("filters.category"), type: "select", options: categoryOptions },
    { key: "documentType", label: t("filters.document"), type: "select", options: docOptions },
    {
      key: "wilaya",
      label: t("filters.wilaya"),
      type: "multiselect",
      display: "dropdown",
      options: wilayaOptions,
    },
    { key: "submitted", label: t("filters.submittedBetween"), type: "daterange" },
  ];

  const short = (type: DocumentType) => t(`short.${type}`);

  const columns: DataColumn<VerificationRow>[] = [
    {
      id: "fullName",
      header: t("columns.account"),
      sortable: true,
      hideable: false,
      cell: (r) => (
        <UserCell
          name={r.user.fullName}
          sub={
            [r.businessName, r.category ? localName(r.category, locale) : null].filter(Boolean).join(" · ") ||
            r.user.email
          }
        />
      ),
    },
    {
      id: "type",
      header: t("columns.type"),
      cell: () => <StatusBadgeCell domain="role" status="provider" />,
    },
    {
      id: "documents",
      header: t("columns.documents"),
      cell: (r) => {
        const missing = r.documents.filter((d) => d.status === "missing");
        const submitted = r.documents.length - missing.length;
        return (
          <StackCell
            primary={
              missing.length === 0
                ? t("documentsCount", { count: r.documents.length })
                : t("documentsOf", { count: submitted, total: r.documents.length })
            }
            secondary={
              missing.length > 0 ? (
                <span className="text-red">
                  {t("missing", { types: missing.map((d) => short(d.type)).join(" · ") })}
                </span>
              ) : (
                r.documents.map((d) => short(d.type)).join(" · ")
              )
            }
          />
        );
      },
    },
    {
      id: "progress",
      header: t("columns.progress"),
      cell: (r) => {
        const p = r.progress;
        const started = p.approved + p.rejected > 0;
        const resubmitted = r.status === "resubmitted";
        return (
          <StackCell
            primary={
              r.status === "incomplete" && !started
                ? t("progress.cantStart")
                : started
                  ? [
                      p.approved ? t("progress.approved", { count: p.approved }) : null,
                      p.rejected ? t("progress.rejected", { count: p.rejected }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("progress.notStarted")
            }
            secondary={
              resubmitted ? (
                <span className="text-brand">{t("progress.resent", { count: p.waiting })}</span>
              ) : p.missing > 0 && r.status === "incomplete" ? (
                t("progress.waitingFor", {
                  types: r.documents
                    .filter((d) => d.status === "missing")
                    .map((d) => short(d.type))
                    .join(" · "),
                })
              ) : p.waiting > 0 ? (
                t("progress.waiting", { count: p.waiting })
              ) : undefined
            }
          />
        );
      },
    },
    {
      id: "wilaya",
      header: t("columns.wilaya"),
      cell: (r) => <span className="text-13 text-ink">{r.wilaya ? localName(r.wilaya, locale) : "—"}</span>,
    },
    {
      id: "submittedAt",
      header: t("columns.submitted"),
      sortable: true,
      cell: (r) =>
        r.submittedAt ? (
          <StackCell
            primary={formatRelative(r.submittedAt, locale)}
            secondary={formatDate(r.submittedAt, locale)}
          />
        ) : (
          <span className="text-13 text-faint">—</span>
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (r) => <StatusBadgeCell domain="verification" status={r.status} />,
    },
  ];

  const reviewHref = (r: VerificationRow) => `/verifications/${r.user.id}${params ? listSearch(params) : ""}`;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("manage") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        actions={
          <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
            {t("export")}
          </Button>
        }
      />
      <DataList<VerificationRow>
        resource={verificationKeys.all}
        queryFn={(p) => listVerifications(verificationsQuery(p))}
        columns={columns}
        getRowId={(r) => r.user.id}
        tabs={(["waiting", "resubmitted", "approved", "rejected", "incomplete", "all"] as const).map((k) => ({
          key: k,
          label: t(`tabs.${k}`),
        }))}
        tabCounts={(r) => (r as VerificationList).meta.counts as Record<string, number> | undefined}
        defaultTab="waiting"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "submittedAt:asc", label: t("sort.oldest") },
          { value: "submittedAt:desc", label: t("sort.newest") },
          { value: "fullName:asc", label: t("sort.name") },
        ]}
        defaultSort="submittedAt:asc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("verifications")}
        columnsStorageKey="verifications"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(r) => router.push(reviewHref(r))}
        rowMenuHeader={(r) => ({ title: r.user.fullName, subtitle: r.businessName ?? undefined })}
        rowMenu={(r) => [
          [
            { icon: <ShieldCheck />, label: t("menu.review"), href: reviewHref(r) },
            { icon: <FileText />, label: t("menu.openProfile"), href: `/users/${r.user.id}` },
          ],
        ]}
        emptyState={
          <EmptyState
            icon={<ShieldCheck />}
            tone="green"
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        }
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="verifications"
        title={t("exportTitle")}
        filters={
          params
            ? Object.fromEntries(
                Object.entries(verificationsQuery(params)).filter(
                  ([k, val]) => !["page", "limit", "sort"].includes(k) && val !== undefined,
                ),
              )
            : {}
        }
        summary={t("exportSummary", { tab: t(`tabs.${params?.tab || "waiting"}`) })}
        columns={[
          { key: "fullName", label: t("exportColumns.fullName") },
          { key: "email", label: t("exportColumns.email") },
          { key: "businessName", label: t("exportColumns.businessName") },
          { key: "category", label: t("exportColumns.category") },
          { key: "wilaya", label: t("exportColumns.wilaya") },
          { key: "status", label: t("exportColumns.status") },
          { key: "documents", label: t("exportColumns.documents") },
          { key: "submittedAt", label: t("exportColumns.submittedAt") },
        ]}
      />
    </>
  );
}
