"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, FileText, GraduationCap, Pencil, UserCheck, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  DataList,
  EntityCell,
  LinkCell,
  StackCell,
  type AdvancedFilterField,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { EmptyState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import type { ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import {
  assignRequest,
  listRequests,
  REQUEST_TABS,
  requestKeys,
  requestsQuery,
  rowRequestActions,
  type RequestList,
  type RequestRow,
} from "@/lib/api/academic-requests";
import { formKeys, listForms } from "@/lib/api/forms";
import { savedViewsSource } from "@/lib/api/saved-views";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils/format";
import { useCatalog } from "../services/use-service-options";
import { localName } from "../users/use-user-options";
import { AcademicTabs } from "./academic-tabs";

export const requestHref = (r: { id: string }) => `/academic-requests/${r.id}`;

export function RequestsScreen() {
  const t = useTranslations("academic");
  const tp = useTranslations("pages.academicRequests");
  const tb = useTranslations("breadcrumb");
  const tpk = useTranslations("packs");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);

  const [days] = useState(() => {
    const at = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
    return { today: at(0), in60: at(60) };
  });
  const stats = useQuery({
    queryKey: [...requestKeys.all, "stats"],
    queryFn: () => listRequests({ limit: 1 }),
  });
  const upcoming = useQuery({
    queryKey: [...requestKeys.all, "stats", "upcoming", days.today],
    queryFn: () => listRequests({ limit: 1, eventDateFrom: days.today, eventDateTo: days.in60 }),
  });
  const counts = stats.data?.meta.counts;
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));
  const quickFilters: QuickFilterItem[] = [
    {
      key: "pending",
      label: t("stats.pending"),
      value: v(counts?.pending),
      hint: t("stats.pendingHint"),
      tone: "amber",
      filter: { status: "pending", eventDate: null },
    },
    {
      key: "changes",
      label: t("stats.changes"),
      value: v(counts?.changes_requested),
      hint: t("stats.changesHint"),
      tone: "gold",
      filter: { status: "changes_requested", eventDate: null },
    },
    {
      key: "upcoming",
      label: t("stats.upcoming"),
      value: v(
        upcoming.data?.meta.counts.approved !== undefined
          ? upcoming.data.meta.counts.approved + upcoming.data.meta.counts.in_progress
          : undefined,
      ),
      hint: t("stats.upcomingHint"),
      tone: "brand",
      filter: { status: null, eventDate: `${days.today}..${days.in60}` },
    },
    {
      key: "rejected",
      label: t("stats.rejected"),
      value: v(counts?.rejected),
      hint: t("stats.rejectedHint"),
      tone: "red",
      filter: { status: "rejected", eventDate: null },
    },
  ];

  const forms = useQuery({
    queryKey: [...formKeys.all, "options"],
    queryFn: () => listForms({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const formOptions = useMemo(
    () =>
      (forms.data?.data ?? []).map((f) => ({
        value: f.id,
        label: locale === "ar" ? f.nameAr || f.nameEn : f.nameEn,
      })),
    [forms.data, locale],
  );

  const filters: FilterConfig[] = [
    { key: "formId", label: t("filters.form"), options: formOptions },
    {
      key: "eventDate",
      label: t("filters.eventDate"),
      options: [
        { value: `${days.today}..`, label: t("filters.upcoming") },
        { value: `${days.today}..${days.in60}`, label: t("filters.next60") },
      ],
      format: (val) => String(val).replace("..", " – "),
    },
    { key: "wilaya", label: t("filters.wilaya"), multiple: true, options: catalog.wilayaOptions },
    {
      key: "assignedAdminId",
      label: t("filters.assignedTo"),
      options: [
        { value: "me", label: t("filters.me") },
        { value: "unassigned", label: t("filters.unassigned") },
      ],
    },
    {
      key: "status",
      label: t("filters.status"),
      options: REQUEST_TABS.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`tabs.${s}`) })),
    },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    { key: "formId", label: t("filters.form"), type: "select", options: formOptions },
    { key: "eventDate", label: t("filters.eventDate"), type: "daterange" },
    {
      key: "wilaya",
      label: t("filters.wilaya"),
      type: "multiselect",
      display: "dropdown",
      options: catalog.wilayaOptions,
    },
    {
      key: "assignedAdminId",
      label: t("filters.assignedTo"),
      type: "segmented",
      options: [
        { value: "me", label: t("filters.me") },
        { value: "unassigned", label: t("filters.unassigned") },
      ],
    },
  ];

  const columns: DataColumn<RequestRow>[] = [
    {
      id: "reference",
      header: t("columns.request"),
      hideable: false,
      cell: (r) => (
        <EntityCell
          icon={<GraduationCap />}
          href={requestHref(r)}
          title={r.title}
          sub={[r.reference, r.eventType ? tpk(`eventTypes.${r.eventType}`) : null]
            .filter(Boolean)
            .join(" · ")}
        />
      ),
    },
    {
      id: "institution",
      header: t("columns.institution"),
      cell: (r) =>
        r.requester.userId ? (
          <LinkCell
            href={`/users/${r.requester.userId}`}
            label={r.institutionName ?? r.requester.name}
            sub={r.requester.name}
          />
        ) : (
          <StackCell primary={r.institutionName ?? r.requester.name} secondary={r.requester.name} />
        ),
    },
    {
      id: "eventDate",
      header: t("columns.eventDate"),
      sortable: true,
      cell: (r) => (
        <StackCell
          primary={r.eventDate ? formatDate(`${r.eventDate}T12:00:00`, locale) : "—"}
          secondary={r.wilaya ? localName(r.wilaya, locale) : undefined}
        />
      ),
    },
    {
      id: "attendees",
      header: t("columns.attendees"),
      cell: (r) => (
        <span className="text-13 text-ink tabular-nums">
          {r.attendees != null ? formatNumber(r.attendees, locale) : "—"}
        </span>
      ),
    },
    {
      id: "budget",
      header: t("columns.budget"),
      cell: (r) => (
        <span className="text-13 text-ink tabular-nums" dir="ltr">
          {r.budgetMin || r.budgetMax
            ? `${formatMoney(r.budgetMin, locale)} – ${formatMoney(r.budgetMax, locale)}`
            : "—"}
        </span>
      ),
    },
    {
      id: "submittedAt",
      header: t("columns.submitted"),
      sortable: true,
      cell: (r) => <StackCell primary={formatDate(r.submittedAt, locale)} secondary={`v${r.form.version}`} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (r) => <StatusBadge domain="request" status={r.status} />,
    },
  ];

  async function assignToMe(r: RequestRow) {
    try {
      await assignRequest(r.id);
      toast.success(t("assigned", { reference: r.reference }));
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
    } catch (e) {
      toast.apiError(e);
    }
  }

  const rowMenu = (r: RequestRow): ActionMenuItem[][] => {
    const actions = rowRequestActions(r.status);
    return [
      [
        { icon: <Eye />, label: t("menu.open"), href: requestHref(r) },
        ...(r.requester.userId
          ? [{ icon: <UserRound />, label: t("menu.openRequester"), href: `/users/${r.requester.userId}` }]
          : []),
      ],
      [
        {
          icon: <UserCheck />,
          label: t("menu.assignToMe"),
          disabled: !actions.includes("assign"),
          onSelect: () => void assignToMe(r),
        },
        {
          icon: <Check />,
          label: t("menu.approve"),
          disabled: !actions.includes("approve"),
          href: `${requestHref(r)}?action=approve`,
        },
        {
          icon: <Pencil />,
          label: t("menu.askChanges"),
          disabled: !actions.includes("request_changes"),
          href: `${requestHref(r)}?action=changes`,
        },
      ],
      [
        {
          icon: <X />,
          label: t("menu.reject"),
          danger: true,
          disabled: !actions.includes("reject"),
          href: `${requestHref(r)}?action=reject`,
        },
      ],
    ];
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("manage") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        className="mb-3"
        actions={
          <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
            {t("export")}
          </Button>
        }
      />
      <AcademicTabs active="requests" />
      <DataList<RequestRow>
        resource={requestKeys.all}
        queryFn={(p) => listRequests(requestsQuery(p))}
        columns={columns}
        getRowId={(r) => r.id}
        tabs={REQUEST_TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
        tabCounts={(res) => (res as RequestList).meta.counts as unknown as Record<string, number>}
        defaultTab="all"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "submittedAt:desc", label: t("sort.newest") },
          { value: "eventDate:asc", label: t("sort.eventSoonest") },
          { value: "reference:desc", label: t("sort.reference") },
        ]}
        defaultSort="submittedAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("academic-requests")}
        columnsStorageKey="academic-requests"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(r) => router.push(requestHref(r))}
        rowMenuHeader={(r) => ({ title: r.title, subtitle: `${r.reference} · ${r.requester.name}` })}
        rowMenu={rowMenu}
        emptyState={
          <EmptyState
            icon={<GraduationCap />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="forms" variant="secondary" onClick={() => router.push("/academic-requests/forms")}>
                {t("manageForms")}
              </Button>,
            ]}
          />
        }
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="academic-requests"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(stats.data?.meta.total ?? 0, locale),
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "reference", label: t("exportColumns.reference") },
          { key: "title", label: t("columns.request") },
          { key: "institution", label: t("columns.institution") },
          { key: "requester", label: t("exportColumns.requester") },
          { key: "eventDate", label: t("columns.eventDate") },
          { key: "wilaya", label: t("filters.wilaya"), defaultChecked: false },
          { key: "attendees", label: t("columns.attendees") },
          { key: "budget", label: t("columns.budget"), defaultChecked: false },
          { key: "status", label: t("columns.status") },
          { key: "submittedAt", label: t("columns.submitted") },
        ]}
      />
    </>
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = requestsQuery(p);
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
