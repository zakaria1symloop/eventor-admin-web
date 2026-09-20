"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  FolderInput,
  Pencil,
  Plus,
  Smartphone,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  DataList,
  EntityCell,
  LinkCell,
  MoneyCell,
  RatingCell,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import { savedViewsSource } from "@/lib/api/saved-views";
import {
  listServices,
  localTitle,
  PRICE_TYPES,
  serviceKeys,
  servicesQuery,
  type ServiceList,
  type ServiceRow,
} from "@/lib/api/services";
import { formatNumber } from "@/lib/utils/format";
import { localName } from "../users/use-user-options";
import {
  BulkDeleteServicesDialog,
  ChangeCategoryDialog,
  DeleteServiceDialog,
  HideServiceDialog,
  showServices,
  toggleFeatured,
  type ServiceTarget,
} from "./service-dialogs";
import { useCatalog } from "./use-service-options";

export const serviceHref = (s: { id: string }) => `/services/${s.id}`;

export function serviceTarget(s: ServiceRow, locale: string): ServiceTarget {
  return {
    id: s.id,
    title: localTitle(s, locale),
    providerName: s.provider.businessName ?? s.provider.fullName,
  };
}

/** Status pill for a row: provider blocked wins, then the service status. */
export function ServiceStatusCell({ s }: { s: Pick<ServiceRow, "status" | "provider" | "visibleInApp"> }) {
  const t = useTranslations("services");
  return (
    <span className="flex flex-col items-start gap-0.5">
      {s.provider.status === "blocked" ? (
        <StatusBadge domain="service" status="provider_blocked" label={t("providerBlocked")} />
      ) : s.status === "published" && s.provider.verificationStatus !== "verified" ? (
        <StatusBadge domain="service" status="waiting_approval" />
      ) : (
        <StatusBadge domain="service" status={s.status} />
      )}
      {!s.visibleInApp && s.status === "published" && (
        <span className="text-11 text-faint">{t("notVisible")}</span>
      )}
    </span>
  );
}

export function ServicesScreen() {
  const t = useTranslations("services");
  const tp = useTranslations("pages.services");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();

  const [hiding, setHiding] = useState<{ rows: ServiceTarget[]; clear?: () => void } | null>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);
  const [bulkDelete, setBulkDelete] = useState<{ rows: ServiceTarget[]; clear: () => void } | null>(null);
  const [recategorize, setRecategorize] = useState<{ rows: ServiceTarget[]; clear: () => void } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: serviceKeys.all });

  const stats = useQuery({
    queryKey: [...serviceKeys.all, "stats"],
    queryFn: () => listServices({ limit: 1 }),
  });
  const counts = stats.data?.meta.counts;
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));
  const blockedProviders = useQuery({
    queryKey: [...serviceKeys.all, "stats", "provider-blocked"],
    queryFn: () => listServices({ limit: 1, providerStatus: "blocked" }),
  });
  const quickFilters: QuickFilterItem[] = [
    {
      key: "published",
      label: t("stats.published"),
      value: v(counts?.published),
      hint: t("stats.publishedHint"),
      tone: "green",
      filter: { status: "published" },
    },
    {
      key: "draft",
      label: t("stats.draft"),
      value: v(counts?.draft),
      hint: t("stats.draftHint"),
      tone: "gray",
      filter: { status: "draft" },
    },
    {
      key: "hidden",
      label: t("stats.hidden"),
      value: v(counts?.hidden),
      hint: t("stats.hiddenHint"),
      tone: "amber",
      filter: { status: "hidden" },
    },
    {
      key: "blocked",
      label: t("stats.providerBlocked"),
      value: v(blockedProviders.data?.meta.total),
      hint: t("stats.providerBlockedHint"),
      tone: "red",
      filter: { providerStatus: "blocked" },
    },
  ];

  const priceTypeOptions = PRICE_TYPES.map((p) => ({ value: p, label: t(`priceTypes.${p}`) }));
  const filters: FilterConfig[] = [
    { key: "categoryId", label: t("filters.category"), options: catalog.categoryOptions },
    { key: "provider", label: t("filters.provider"), options: catalog.providerOptions },
    { key: "wilaya", label: t("filters.wilaya"), options: catalog.wilayaOptions, multiple: true },
    {
      key: "price",
      label: t("filters.price"),
      options: [
        { value: "..20000", label: t("filters.priceUnder", { amount: "20 000" }) },
        { value: "20000..100000", label: "20 000 – 100 000" },
        { value: "100000..", label: t("filters.priceOver", { amount: "100 000" }) },
      ],
      format: (val) => {
        const [from = "", to = ""] = String(val).split("..");
        return from && to ? `${from} – ${to} DA` : from ? `≥ ${from} DA` : `≤ ${to} DA`;
      },
    },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    { key: "categoryId", label: t("filters.category"), type: "select", options: catalog.categoryOptions },
    { key: "provider", label: t("filters.provider"), type: "select", options: catalog.providerOptions },
    {
      key: "wilaya",
      label: t("filters.wilaya"),
      type: "multiselect",
      display: "dropdown",
      options: catalog.wilayaOptions,
    },
    { key: "price", label: t("filters.priceRange"), type: "range", suffix: "DA" },
    { key: "priceType", label: t("filters.priceType"), type: "select", options: priceTypeOptions },
    {
      key: "ratingMin",
      label: t("filters.rating"),
      type: "segmented",
      options: ["3.5", "4", "4.5"].map((r) => ({ value: r, label: `${r}+` })),
    },
    {
      key: "status",
      label: t("filters.status"),
      type: "segmented",
      options: ["published", "draft", "hidden"].map((s) => ({ value: s, label: t(`statuses.${s}`) })),
    },
    { key: "featured", label: t("filters.featured"), type: "toggle", toggleLabel: t("filters.featuredOnly") },
    {
      key: "providerStatus",
      label: t("filters.providerStatus"),
      type: "segmented",
      options: [
        { value: "active", label: t("filters.providerActive") },
        { value: "blocked", label: t("filters.providerBlocked") },
      ],
    },
    { key: "created", label: t("filters.created"), type: "daterange" },
  ];

  const columns: DataColumn<ServiceRow>[] = [
    {
      id: "title",
      header: t("columns.service"),
      sortable: true,
      hideable: false,
      cell: (s) => (
        <EntityCell
          thumb={s.coverUrl}
          icon={<Briefcase />}
          href={serviceHref(s)}
          title={
            <span className="inline-flex items-center gap-1.5">
              {localTitle(s, locale)}
              {s.isFeatured && (
                <Star className="size-3.5 shrink-0 fill-gold text-gold" aria-label={t("featuredLabel")} />
              )}
            </span>
          }
          sub={[t(`priceTypes.${s.priceType}`), s.wilayas.map((w) => localName(w, locale)).join(", ")]
            .filter(Boolean)
            .join(" · ")}
        />
      ),
    },
    {
      id: "provider",
      header: t("columns.provider"),
      cell: (s) => (
        <LinkCell
          href={`/users/${s.provider.id}`}
          label={s.provider.businessName ?? s.provider.fullName}
          sub={s.provider.businessName ? s.provider.fullName : undefined}
        />
      ),
    },
    {
      id: "category",
      header: t("columns.category"),
      cell: (s) => <span className="text-13 text-ink">{localName(s.category, locale)}</span>,
    },
    {
      id: "price",
      header: t("columns.price"),
      sortable: true,
      cell: (s) => <MoneyCell value={s.basePrice} sub={t(`priceTypesShort.${s.priceType}`)} />,
    },
    {
      id: "rating",
      header: t("columns.rating"),
      sortable: true,
      cell: (s) => <RatingCell value={s.rating} count={s.ratingCount} />,
    },
    {
      id: "bookingsCount",
      header: t("columns.bookings"),
      sortable: true,
      cell: (s) => (
        <span className="text-13 text-ink tabular-nums">{formatNumber(s.bookingsCount, locale)}</span>
      ),
    },
    { id: "status", header: t("columns.status"), cell: (s) => <ServiceStatusCell s={s} /> },
  ];

  const rowMenu = (s: ServiceRow) => {
    const target = serviceTarget(s, locale);
    return [
      [
        { icon: <Eye />, label: t("menu.open"), href: serviceHref(s), shortcut: t("menu.enter") },
        { icon: <UserRound />, label: t("menu.openProvider"), href: `/users/${s.provider.id}` },
        {
          icon: <CalendarDays />,
          label: t("menu.viewBookings"),
          href: `/bookings?service=${s.id}`,
          hint: s.bookingsCount,
        },
        {
          icon: <Star />,
          label: t("menu.viewReviews"),
          href: `/reviews?service=${s.id}`,
          hint: s.ratingCount,
        },
        { icon: <Smartphone />, label: t("menu.viewInApp"), disabled: true, hint: t("soon") },
      ],
      [
        { icon: <Pencil />, label: t("menu.edit"), href: `/services/${s.id}/edit` },
        {
          icon: <Star />,
          label: s.isFeatured ? t("menu.unfeature") : t("menu.feature"),
          disabled: s.status !== "published" && !s.isFeatured,
          onSelect: () =>
            void toggleFeatured({ ...target, isFeatured: s.isFeatured }, t, () => void invalidate()),
        },
        s.status === "hidden"
          ? {
              icon: <Eye />,
              label: t("menu.show"),
              onSelect: () => void showServices([target], t, () => void invalidate()),
            }
          : {
              icon: <EyeOff />,
              label: t("menu.hide"),
              disabled: s.status !== "published",
              onSelect: () => setHiding({ rows: [target] }),
            },
      ],
      [{ icon: <Trash2 />, label: t("menu.delete"), danger: true, onSelect: () => setDeleting(s) }],
    ];
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("manage") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={tp("subtitle")}
        actions={
          <>
            <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
              {t("export")}
            </Button>
            <Button icon={<Plus />} onClick={() => router.push("/services/new")}>
              {t("addService")}
            </Button>
          </>
        }
      />
      <DataList<ServiceRow>
        resource={serviceKeys.all}
        queryFn={(p) => listServices(servicesQuery(p))}
        columns={columns}
        getRowId={(s) => s.id}
        tabs={[
          { key: "all", label: t("tabs.all") },
          { key: "published", label: t("tabs.published") },
          { key: "draft", label: t("tabs.draft") },
          { key: "waiting_approval", label: t("tabs.waiting_approval") },
          { key: "hidden", label: t("tabs.hidden") },
          { key: "reported", label: t("tabs.reported") },
        ]}
        tabCounts={(r) => (r as ServiceList).meta.counts as unknown as Record<string, number>}
        defaultTab="all"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "createdAt:desc", label: t("sort.newest") },
          { value: "bookingsCount:desc", label: t("sort.mostBooked") },
          { value: "rating:desc", label: t("sort.rating") },
          { value: "price:asc", label: t("sort.priceLow") },
          { value: "price:desc", label: t("sort.priceHigh") },
          { value: "title:asc", label: t("sort.title") },
        ]}
        defaultSort="createdAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("services")}
        columnsStorageKey="services"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(s) => router.push(serviceHref(s))}
        rowMenuHeader={(s) => ({
          title: localTitle(s, locale),
          subtitle: [s.provider.businessName ?? s.provider.fullName, localName(s.category, locale)].join(
            " · ",
          ),
        })}
        rowMenu={rowMenu}
        bulkActions={(rows, clear) => {
          const targets = rows.map((r) => serviceTarget(r, locale));
          const published = rows.filter((r) => r.status === "published");
          const hidden = rows.filter((r) => r.status === "hidden");
          return (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<EyeOff />}
                disabled={published.length === 0}
                onClick={() => setHiding({ rows: published.map((r) => serviceTarget(r, locale)), clear })}
              >
                {t("bulk.hide")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Eye />}
                disabled={hidden.length === 0}
                onClick={() =>
                  void showServices(
                    hidden.map((r) => serviceTarget(r, locale)),
                    t,
                    () => {
                      clear();
                      void invalidate();
                    },
                  )
                }
              >
                {t("bulk.show")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderInput />}
                onClick={() => setRecategorize({ rows: targets, clear })}
              >
                {t("bulk.changeCategory")}
              </Button>
              <Button
                variant="danger-outline"
                size="sm"
                icon={<Trash2 />}
                onClick={() => setBulkDelete({ rows: targets, clear })}
              >
                {t("bulk.delete")}
              </Button>
            </>
          );
        }}
        emptyState={
          <EmptyState
            icon={<Briefcase />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="add" icon={<Plus />} onClick={() => router.push("/services/new")}>
                {t("addService")}
              </Button>,
            ]}
          />
        }
      />

      <HideServiceDialog
        services={hiding?.rows ?? []}
        open={!!hiding}
        onOpenChange={(o) => !o && setHiding(null)}
        onDone={() => {
          hiding?.clear?.();
          void invalidate();
        }}
      />
      <DeleteServiceDialog
        service={deleting ? serviceTarget(deleting, locale) : null}
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        impact={deleting ? { reviews: deleting.ratingCount } : undefined}
        onHideInstead={
          deleting?.status === "published"
            ? () => {
                const s = deleting;
                setDeleting(null);
                setHiding({ rows: [serviceTarget(s, locale)] });
              }
            : undefined
        }
        onDeleted={() => void invalidate()}
      />
      <BulkDeleteServicesDialog
        services={bulkDelete?.rows ?? []}
        onOpenChange={(o) => !o && setBulkDelete(null)}
        onDone={() => {
          bulkDelete?.clear();
          void invalidate();
        }}
      />
      <ChangeCategoryDialog
        services={recategorize?.rows ?? []}
        options={catalog.visibleCategoryOptions}
        onOpenChange={(o) => !o && setRecategorize(null)}
        onDone={() => {
          recategorize?.clear();
          void invalidate();
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="services"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(stats.data?.meta.total ?? 0, locale),
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "titleEn", label: t("exportColumns.titleEn") },
          { key: "titleAr", label: t("exportColumns.titleAr") },
          { key: "provider", label: t("exportColumns.provider") },
          { key: "category", label: t("exportColumns.category") },
          { key: "basePrice", label: t("exportColumns.basePrice") },
          { key: "priceType", label: t("exportColumns.priceType") },
          { key: "wilayas", label: t("exportColumns.wilayas"), defaultChecked: false },
          { key: "rating", label: t("exportColumns.rating") },
          { key: "bookingsCount", label: t("exportColumns.bookingsCount") },
          { key: "status", label: t("exportColumns.status") },
          { key: "isFeatured", label: t("exportColumns.isFeatured"), defaultChecked: false },
          { key: "createdAt", label: t("exportColumns.createdAt") },
        ]}
      />
    </>
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = servicesQuery(p);
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
