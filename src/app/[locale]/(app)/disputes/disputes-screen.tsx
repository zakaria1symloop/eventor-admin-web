"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  ShieldAlert,
  TriangleAlert,
  UserCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  DataList,
  EntityCell,
  LinkCell,
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
  assignDispute,
  DISPUTE_TABS,
  DISPUTE_TYPES,
  DISPUTABLE_BOOKING_STATUSES,
  disputeKeys,
  disputesQuery,
  isActiveDispute,
  listDisputes,
  type DisputeList,
  type DisputeRow,
  type DisputeType,
} from "@/lib/api/disputes";
import { savedViewsSource } from "@/lib/api/saved-views";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { CloseDisputeDialog, OpenDisputeDialog, ResolveDisputeDialog } from "./dispute-dialogs";

export const disputeHref = (d: { id: string }) => `/disputes/${d.id}`;

export const disputeTypeIcon: Record<DisputeType, ReactNode> = {
  provider_no_show: <Ban />,
  client_no_show: <UserRound />,
  service_not_as_described: <Camera />,
  incomplete_or_late: <CalendarClock />,
  price_disagreement: <Pencil />,
  cancellation_disagreement: <XCircle />,
  damage_or_safety: <ShieldAlert />,
  behaviour: <MessageCircle />,
  other: <TriangleAlert />,
};

const TAB_COUNT_KEY: Record<string, keyof DisputeList["meta"]["counts"]> = {
  open: "open",
  in_review: "inReview",
  resolved: "resolved",
  closed: "closed",
  all: "all",
};

export function DisputesScreen() {
  const t = useTranslations("disputes");
  const tBooking = useTranslations("status.booking");
  const tp = useTranslations("pages.disputes");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useQueryState("new", parseAsString.withOptions({ history: "replace" }));
  const [prefillBooking, setPrefillBooking] = useQueryState(
    "booking",
    parseAsString.withOptions({ history: "replace" }),
  );
  const [resolving, setResolving] = useState<DisputeRow | null>(null);
  const [closing, setClosing] = useState<DisputeRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);

  const [days] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const stats = useQuery({
    queryKey: [...disputeKeys.all, "stats"],
    queryFn: () => listDisputes({ limit: 1 }),
  });
  const unassigned = useQuery({
    queryKey: [...disputeKeys.all, "stats", "unassigned"],
    queryFn: () => listDisputes({ limit: 1, tab: "open", assignedAdminId: "unassigned" }),
  });
  const counts = stats.data?.meta.counts;
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));

  const quickFilters: QuickFilterItem[] = [
    {
      key: "open",
      label: t("stats.open"),
      value: v(counts?.open),
      hint: t("stats.openHint", { count: unassigned.data?.meta.total ?? 0 }),
      tone: "red",
      filter: { status: "open", created: null },
    },
    {
      key: "inReview",
      label: t("stats.inReview"),
      value: v(counts?.inReview),
      hint: t("stats.inReviewHint"),
      tone: "amber",
      filter: { status: "in_review", created: null },
    },
    {
      key: "resolved",
      label: t("stats.resolved30"),
      value: v(counts?.resolved30d),
      hint: t("stats.resolvedHint"),
      tone: "green",
      filter: { status: "resolved", created: `${days}..` },
    },
    {
      key: "closed",
      label: t("stats.closed30"),
      value: v(counts?.closed30d),
      hint: t("stats.closedHint"),
      tone: "gold",
      filter: { status: "closed", created: `${days}..` },
    },
  ];

  const selected = () => t("filters.selected");
  const filters: FilterConfig[] = [
    {
      key: "type",
      label: t("filters.type"),
      multiple: true,
      options: DISPUTE_TYPES.map((k) => ({ value: k, label: t(`types.${k}`) })),
    },
    {
      key: "openedByRole",
      label: t("filters.openedBy"),
      options: (["client", "provider", "admin"] as const).map((r) => ({ value: r, label: t(`roles.${r}`) })),
    },
    {
      key: "assignedAdminId",
      label: t("filters.assignedTo"),
      options: [
        { value: "me", label: t("filters.me") },
        { value: "unassigned", label: t("filters.unassigned") },
      ],
      format: (val) =>
        val === "me" ? t("filters.me") : val === "unassigned" ? t("filters.unassigned") : selected(),
    },
    // URL-only filters (quick cards, profile and booking links).
    {
      key: "status",
      label: t("filters.status"),
      options: DISPUTE_TABS.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`tabs.${s}`) })),
    },
    { key: "userId", label: t("filters.user"), options: [], format: selected },
    { key: "bookingId", label: t("filters.booking"), options: [], format: selected },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    {
      key: "type",
      label: t("filters.type"),
      type: "multiselect",
      display: "dropdown",
      options: DISPUTE_TYPES.map((k) => ({ value: k, label: t(`types.${k}`) })),
    },
    {
      key: "openedByRole",
      label: t("filters.openedBy"),
      type: "segmented",
      options: (["client", "provider", "admin"] as const).map((r) => ({ value: r, label: t(`roles.${r}`) })),
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
    {
      key: "bookingStatus",
      label: t("filters.bookingStatus"),
      type: "multiselect",
      display: "dropdown",
      options: DISPUTABLE_BOOKING_STATUSES.map((s) => ({ value: s, label: tBooking(s) })),
    },
    { key: "created", label: t("filters.created"), type: "daterange" },
  ];

  const party = (p: DisputeRow["openedBy"]) => (
    <LinkCell href={`/users/${p.id}`} label={p.fullName} sub={t(`roles.${p.role}`)} />
  );
  const columns: DataColumn<DisputeRow>[] = [
    {
      id: "reference",
      header: t("columns.dispute"),
      hideable: false,
      cell: (d) => (
        <EntityCell
          icon={disputeTypeIcon[d.type]}
          href={disputeHref(d)}
          title={d.reference}
          sub={t(`types.${d.type}`)}
        />
      ),
    },
    {
      id: "booking",
      header: t("columns.booking"),
      cell: (d) => (
        <LinkCell
          href={`/bookings/${d.booking.id}`}
          label={`#${d.booking.reference}`}
          sub={locale === "ar" ? d.booking.titleAr || d.booking.titleEn : d.booking.titleEn}
        />
      ),
    },
    { id: "openedBy", header: t("columns.openedBy"), cell: (d) => party(d.openedBy) },
    { id: "against", header: t("columns.against"), cell: (d) => party(d.against) },
    {
      id: "assignedAdmin",
      header: t("columns.assigned"),
      cell: (d) => (
        <span className={d.assignedAdmin ? "text-13 text-ink" : "text-13 text-faint"}>
          {d.assignedAdmin?.fullName ?? t("unassigned")}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: t("columns.opened"),
      sortable: true,
      cell: (d) => <span className="text-13 text-ink-2">{formatDate(d.createdAt, locale)}</span>,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (d) => <StatusBadge domain="dispute" status={d.status} />,
    },
  ];

  async function assignToMe(d: DisputeRow) {
    try {
      await assignDispute(d.id);
      toast.success(t("assigned", { reference: d.reference }));
      void queryClient.invalidateQueries({ queryKey: disputeKeys.all });
    } catch (e) {
      toast.apiError(e);
    }
  }

  const rowMenu = (d: DisputeRow): ActionMenuItem[][] => {
    const active = isActiveDispute(d.status);
    return [
      [
        { icon: <Eye />, label: t("menu.open"), href: disputeHref(d) },
        { icon: <FileText />, label: t("menu.openBooking"), href: `/bookings/${d.booking.id}` },
      ],
      [
        {
          icon: <UserCheck />,
          label: t("menu.assignToMe"),
          disabled: !active,
          onSelect: () => void assignToMe(d),
        },
        {
          icon: <CheckCircle2 />,
          label: t("menu.resolve"),
          disabled: !active,
          onSelect: () => setResolving(d),
        },
      ],
      [
        {
          icon: <XCircle />,
          label: t("menu.close"),
          danger: true,
          disabled: !active,
          onSelect: () => setClosing(d),
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
        actions={
          <>
            <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
              {t("export")}
            </Button>
            <Button icon={<Plus />} onClick={() => void setCreating("1")}>
              {t("openDispute")}
            </Button>
          </>
        }
      />
      <DataList<DisputeRow>
        resource={disputeKeys.all}
        queryFn={(p) => listDisputes(disputesQuery(p))}
        columns={columns}
        getRowId={(d) => d.id}
        tabs={DISPUTE_TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
        tabCounts={(r) => {
          const c = (r as DisputeList).meta.counts;
          return c
            ? Object.fromEntries(Object.entries(TAB_COUNT_KEY).map(([tab, key]) => [tab, c[key]]))
            : undefined;
        }}
        defaultTab="open"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "createdAt:asc", label: t("sort.oldest") },
          { value: "createdAt:desc", label: t("sort.newest") },
          { value: "lastActivityAt:desc", label: t("sort.activity") },
        ]}
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("disputes")}
        columnsStorageKey="disputes"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(d) => router.push(disputeHref(d))}
        rowProps={(d) => ({
          className: d.status === "open" && !d.assignedAdmin ? "bg-red-soft/30" : undefined,
        })}
        rowMenuHeader={(d) => ({
          title: d.reference,
          subtitle: `#${d.booking.reference} · ${t(`types.${d.type}`)}`,
        })}
        rowMenu={rowMenu}
        emptyState={
          <EmptyState
            icon={<CircleDollarSign />}
            tone="green"
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        }
      />
      <OpenDisputeDialog
        open={creating === "1"}
        bookingId={prefillBooking}
        onOpenChange={(o) => {
          if (!o) {
            void setCreating(null);
            void setPrefillBooking(null);
          }
        }}
      />
      <ResolveDisputeDialog
        disputeId={resolving?.id ?? null}
        open={!!resolving}
        onOpenChange={(o) => !o && setResolving(null)}
      />
      <CloseDisputeDialog dispute={closing} open={!!closing} onOpenChange={(o) => !o && setClosing(null)} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="disputes"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(stats.data?.meta.total ?? 0, locale),
          tab: t(`tabs.${params?.tab || "open"}`),
        })}
        columns={[
          { key: "reference", label: t("columns.dispute") },
          { key: "type", label: t("filters.type") },
          { key: "booking", label: t("columns.booking") },
          { key: "openedBy", label: t("columns.openedBy") },
          { key: "against", label: t("columns.against") },
          { key: "assignedAdmin", label: t("columns.assigned") },
          { key: "status", label: t("columns.status") },
          { key: "createdAt", label: t("columns.opened") },
        ]}
      />
    </>
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = disputesQuery(p);
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
