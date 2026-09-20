"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCheck,
  Eye,
  FileText,
  Layers,
  MessageCircle,
  Pencil,
  Plus,
  TriangleAlert,
  RotateCcw,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  DataList,
  EntityCell,
  LinkCell,
  MoneyCell,
  StackCell,
  type AdvancedFilterField,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { EmptyState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import type { ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  BOOKING_SOURCES,
  BOOKING_TABS,
  bookingKeys,
  bookingsQuery,
  canOpenDispute,
  getBooking,
  isEditable,
  listBookings,
  offerTitle,
  rowTransitions,
  type BookingDetail,
  type BookingList,
  type BookingRow,
  type StatusAction,
} from "@/lib/api/bookings";
import { savedViewsSource } from "@/lib/api/saved-views";
import { listUsers, userKeys } from "@/lib/api/users";
import { formatDate, formatNumber, intlLocale } from "@/lib/utils/format";
import { useCatalog } from "../services/use-service-options";
import {
  BookingStatusCell,
  InvoiceModal,
  PriceDrawer,
  remindProviders,
  RescheduleDialog,
  StatusDialog,
  type StatusTarget,
} from "./booking-dialogs";
import { CreateBookingDrawer } from "./create-booking-drawer";

export const bookingHref = (b: { id: string }) => `/bookings/${b.id}`;

const statusIcon: Record<StatusAction, React.ReactNode> = {
  accepted: <Check />,
  declined: <X />,
  cancelled: <XCircle />,
  completed: <CheckCheck />,
  reopen: <RotateCcw />,
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function statusTarget(b: BookingRow | BookingDetail): StatusTarget {
  return { id: b.id, reference: b.reference, clientName: b.client.fullName, status: b.status };
}

/** "Sat 14 Mar 2026" + "13:00 → 23:00" */
export function EventDateCell({ b }: { b: Pick<BookingRow, "eventDate" | "startTime" | "endTime"> }) {
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${b.eventDate}T12:00:00`));
  const times =
    b.startTime && b.endTime ? `${b.startTime.slice(0, 5)} → ${b.endTime.slice(0, 5)}` : undefined;
  return <StackCell primary={date} secondary={times && <span dir="ltr">{times}</span>} />;
}

export function BookingsScreen() {
  const t = useTranslations("bookings");
  const tp = useTranslations("pages.bookings");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const [creating, setCreating] = useQueryState("new", parseAsString.withOptions({ history: "replace" }));

  const [statusChange, setStatusChange] = useState<{
    rows: StatusTarget[];
    action: StatusAction;
    clear?: () => void;
  } | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingRow | null>(null);
  const [pricing, setPricing] = useState<BookingDetail | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: bookingKeys.all });

  const stats = useQuery({
    queryKey: [...bookingKeys.all, "stats"],
    queryFn: () => listBookings({ limit: 1 }),
  });
  // Day boundaries fixed for the life of the screen (render must stay pure).
  const [days] = useState(() => {
    const now = Date.now();
    const at = (d: number) => iso(new Date(now + d * 86400_000));
    return { today: at(0), in7: at(7), in30: at(30), yesterday: at(-1) };
  });
  const upcoming = useQuery({
    queryKey: [...bookingKeys.all, "stats", "upcoming"],
    queryFn: () =>
      listBookings({ limit: 1, tab: "accepted", eventDateFrom: days.today, eventDateTo: days.in30 }),
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
      filter: { status: "pending", noReply: null },
    },
    {
      key: "noReply",
      label: t("stats.noReply"),
      value: v(counts?.noReply),
      hint: t("stats.noReplyHint"),
      tone: "red",
      filter: { noReply: "true" },
    },
    {
      key: "upcoming",
      label: t("stats.upcoming"),
      value: v(upcoming.data?.meta.total),
      hint: t("stats.upcomingHint"),
      tone: "brand",
      filter: { status: "accepted", eventDate: `${days.today}..${days.in30}` },
    },
    {
      key: "disputed",
      label: t("stats.disputed"),
      value: v(counts?.disputed),
      hint: t("stats.disputedHint"),
      tone: "gray",
      filter: { disputeStatus: "open" },
    },
  ];

  const clients = useQuery({
    queryKey: [...userKeys.all, "client-options"],
    queryFn: () => listUsers({ role: "client", limit: 100, sort: "fullName:asc" }),
    staleTime: 5 * 60_000,
  });
  const clientOptions = useMemo(
    () => (clients.data?.data ?? []).map((c) => ({ value: c.id, label: c.fullName })),
    [clients.data],
  );

  const eventDatePresets = [
    { value: `${days.today}..${days.in7}`, label: t("filters.next7") },
    { value: `${days.today}..${days.in30}`, label: t("filters.next30") },
    { value: `${days.today}..`, label: t("filters.upcomingAll") },
    { value: `..${days.yesterday}`, label: t("filters.past") },
  ];
  const selected = () => t("filters.selected");
  const filters: FilterConfig[] = [
    {
      key: "eventDate",
      label: t("filters.eventDate"),
      options: eventDatePresets,
      format: (val) =>
        eventDatePresets.find((p) => p.value === val)?.label ?? String(val).replace("..", " – "),
    },
    { key: "categoryId", label: t("filters.category"), options: catalog.categoryOptions },
    { key: "provider", label: t("filters.provider"), options: catalog.providerOptions },
    { key: "client", label: t("filters.client"), options: clientOptions },
    // URL-only filters (links from services, packs, profiles, academic requests).
    {
      key: "status",
      label: t("filters.status"),
      options: BOOKING_TABS.map((s) => ({ value: s, label: t(`tabs.${s}`) })),
    },
    { key: "service", label: t("filters.service"), options: [], format: selected },
    { key: "pack", label: t("filters.pack"), options: [], format: selected },
    { key: "academicRequest", label: t("filters.academicRequest"), options: [], format: selected },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    { key: "noReply", label: t("filters.noReply"), type: "toggle", toggleLabel: t("filters.noReplyOnly") },
    { key: "eventDate", label: t("filters.eventDate"), type: "daterange" },
    {
      key: "wilaya",
      label: t("filters.wilaya"),
      type: "multiselect",
      display: "dropdown",
      options: catalog.wilayaOptions,
    },
    { key: "amount", label: t("filters.amount"), type: "range", suffix: "DA" },
    {
      key: "source",
      label: t("filters.source"),
      type: "segmented",
      options: BOOKING_SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) })),
    },
    {
      key: "disputeStatus",
      label: t("filters.dispute"),
      type: "segmented",
      options: (["none", "open", "resolved"] as const).map((s) => ({
        value: s,
        label: t(`disputeStatuses.${s}`),
      })),
    },
    { key: "created", label: t("filters.created"), type: "daterange" },
  ];

  const columns: DataColumn<BookingRow>[] = [
    {
      id: "reference",
      header: t("columns.booking"),
      hideable: false,
      cell: (b) => (
        <EntityCell
          icon={b.pack ? <Layers /> : <Briefcase />}
          href={bookingHref(b)}
          title={`#${b.reference}`}
          sub={[offerTitle(b, locale), b.pack ? t("readyPack") : null].filter(Boolean).join(" · ")}
        />
      ),
    },
    {
      id: "client",
      header: t("columns.client"),
      cell: (b) => (
        <LinkCell
          href={`/users/${b.client.id}`}
          label={b.client.fullName}
          sub={[t("clientRole"), b.guests ? t("guests", { count: b.guests }) : null]
            .filter(Boolean)
            .join(" · ")}
        />
      ),
    },
    {
      id: "provider",
      header: t("columns.provider"),
      cell: (b) => (
        <LinkCell
          href={`/users/${b.provider.id}`}
          label={b.provider.businessName ?? b.provider.fullName}
          sub={b.provider.businessName ? b.provider.fullName : undefined}
        />
      ),
    },
    { id: "eventDate", header: t("columns.eventDate"), sortable: true, cell: (b) => <EventDateCell b={b} /> },
    {
      id: "total",
      header: t("columns.amount"),
      sortable: true,
      cell: (b) => <MoneyCell value={b.total} />,
    },
    { id: "status", header: t("columns.status"), cell: (b) => <BookingStatusCell b={b} /> },
    {
      id: "createdAt",
      header: t("columns.requested"),
      sortable: true,
      cell: (b) => (
        <StackCell primary={formatDate(b.createdAt, locale)} secondary={t(`sources.${b.source}`)} />
      ),
    },
  ];

  async function openPrice(b: BookingRow) {
    try {
      setPricing(
        await queryClient.fetchQuery({ queryKey: bookingKeys.detail(b.id), queryFn: () => getBooking(b.id) }),
      );
    } catch {
      router.push(`${bookingHref(b)}?price=1`);
    }
  }

  const rowMenu = (b: BookingRow): ActionMenuItem[][] => {
    const moves = rowTransitions(b.status);
    const editable = isEditable(b.status);
    const offer = b.service
      ? { icon: <Briefcase />, label: t("menu.openService"), href: `/services/${b.service.id}` }
      : b.pack
        ? { icon: <Layers />, label: t("menu.openPack"), href: `/packs/${b.pack.id}` }
        : null;
    return [
      [
        { icon: <Eye />, label: t("menu.open"), href: bookingHref(b), shortcut: t("menu.enter") },
        { icon: <UserRound />, label: t("menu.openClient"), href: `/users/${b.client.id}` },
        { icon: <Briefcase />, label: t("menu.openProvider"), href: `/users/${b.provider.id}` },
        ...(offer ? [offer] : []),
        { icon: <MessageCircle />, label: t("menu.openConversation"), href: `/messages?booking=${b.id}` },
      ],
      [
        ...moves
          .filter((a) => a !== "cancelled")
          .map((a) => ({
            icon: statusIcon[a],
            label: t(`menu.${a}`),
            onSelect: () => setStatusChange({ rows: [statusTarget(b)], action: a }),
          })),
        ...(b.status === "pending"
          ? [{ icon: <Bell />, label: t("menu.remind"), onSelect: () => void remindProviders([b], t) }]
          : []),
        {
          icon: <CalendarDays />,
          label: t("menu.reschedule"),
          disabled: !editable,
          onSelect: () => setRescheduling(b),
        },
        {
          icon: <Pencil />,
          label: t("menu.adjustPrice"),
          disabled: !editable,
          onSelect: () => void openPrice(b),
        },
        {
          icon: <TriangleAlert />,
          label: t("menu.openDispute"),
          disabled: !canOpenDispute(b),
          href: `/disputes?new=1&booking=${b.id}`,
        },
        {
          icon: <FileText />,
          label: t("menu.viewInvoice"),
          disabled: b.status === "pending" || b.status === "declined",
          onSelect: () => setInvoiceFor(b.id),
        },
      ],
      ...(moves.includes("cancelled")
        ? [
            [
              {
                icon: <XCircle />,
                label: t("menu.cancelled"),
                danger: true,
                onSelect: () => setStatusChange({ rows: [statusTarget(b)], action: "cancelled" }),
              },
            ],
          ]
        : []),
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
              {t("createBooking")}
            </Button>
          </>
        }
      />
      <DataList<BookingRow>
        resource={bookingKeys.all}
        queryFn={(p) => listBookings(bookingsQuery(p))}
        columns={columns}
        getRowId={(b) => b.id}
        tabs={BOOKING_TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
        tabCounts={(r) => (r as BookingList).meta.counts as unknown as Record<string, number>}
        defaultTab="all"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "createdAt:desc", label: t("sort.newest") },
          { value: "eventDate:asc", label: t("sort.eventSoonest") },
          { value: "eventDate:desc", label: t("sort.eventLatest") },
          { value: "total:desc", label: t("sort.amountHigh") },
          { value: "total:asc", label: t("sort.amountLow") },
        ]}
        defaultSort="createdAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("bookings")}
        columnsStorageKey="bookings"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(b) => router.push(bookingHref(b))}
        rowMenuHeader={(b) => ({
          title: `#${b.reference}`,
          subtitle: `${b.client.fullName} · ${b.provider.businessName ?? b.provider.fullName}`,
        })}
        rowMenu={rowMenu}
        bulkActions={(rows, clear) => {
          const cancellable = rows.filter((r) => r.status === "pending" || r.status === "accepted");
          const pending = rows.filter((r) => r.status === "pending");
          return (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Bell />}
                disabled={pending.length === 0}
                onClick={() => void remindProviders(pending, t, () => void invalidate())}
              >
                {t("bulk.remind", { count: pending.length })}
              </Button>
              <Button
                variant="danger-outline"
                size="sm"
                icon={<XCircle />}
                disabled={cancellable.length === 0}
                onClick={() =>
                  setStatusChange({ rows: cancellable.map(statusTarget), action: "cancelled", clear })
                }
              >
                {t("bulk.cancel", { count: cancellable.length })}
              </Button>
            </>
          );
        }}
        emptyState={
          <EmptyState
            icon={<CalendarPlus />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="new" icon={<Plus />} onClick={() => void setCreating("1")}>
                {t("createBooking")}
              </Button>,
            ]}
          />
        }
      />

      <StatusDialog
        bookings={statusChange?.rows ?? []}
        action={statusChange?.action ?? null}
        onOpenChange={(o) => !o && setStatusChange(null)}
        onDone={() => {
          statusChange?.clear?.();
          void invalidate();
        }}
      />
      <RescheduleDialog
        booking={rescheduling}
        open={!!rescheduling}
        onOpenChange={(o) => !o && setRescheduling(null)}
        onDone={() => void invalidate()}
      />
      <PriceDrawer
        booking={pricing}
        open={!!pricing}
        onOpenChange={(o) => !o && setPricing(null)}
        onDone={() => void invalidate()}
      />
      {invoiceFor && (
        <InvoiceModal bookingId={invoiceFor} open onOpenChange={(o) => !o && setInvoiceFor(null)} />
      )}
      <CreateBookingDrawer open={creating === "1"} onOpenChange={(o) => !o && void setCreating(null)} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="bookings"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(stats.data?.meta.total ?? 0, locale),
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "reference", label: t("exportColumns.reference") },
          { key: "offer", label: t("exportColumns.offer") },
          { key: "client", label: t("exportColumns.client") },
          { key: "provider", label: t("exportColumns.provider") },
          { key: "eventDate", label: t("exportColumns.eventDate") },
          { key: "eventType", label: t("exportColumns.eventType"), defaultChecked: false },
          { key: "wilaya", label: t("exportColumns.wilaya"), defaultChecked: false },
          { key: "total", label: t("exportColumns.total") },
          { key: "status", label: t("exportColumns.status") },
          { key: "source", label: t("exportColumns.source"), defaultChecked: false },
          { key: "createdAt", label: t("exportColumns.createdAt") },
        ]}
      />
    </>
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = bookingsQuery(p);
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
