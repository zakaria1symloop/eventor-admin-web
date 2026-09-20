"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, FileText, Layers, Pencil, Plus, Send, Trash2, UserRound } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  DataList,
  EntityCell,
  LinkCell,
  MoneyCell,
  QuickFilterCards,
  RatingCell,
  type AdvancedFilterField,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { EmptyState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  deletePack,
  EVENT_TYPES,
  listPacks,
  localPackName,
  packAction,
  packKeys,
  packsQuery,
  type PackList,
  type PackRow,
} from "@/lib/api/packs";
import { savedViewsSource } from "@/lib/api/saved-views";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { useCatalog } from "../services/use-service-options";
import { localName } from "../users/use-user-options";

export interface PackTarget {
  id: string;
  name: string;
  bookingsCount?: number;
}

export function PackStatusCell({ p }: { p: Pick<PackRow, "status" | "needsAttention" | "provider"> }) {
  const t = useTranslations("packs");
  if (p.provider.status === "blocked")
    return <StatusBadge domain="pack" status="provider_blocked" label={t("providerBlocked")} />;
  if (p.needsAttention)
    return <StatusBadge domain="pack" status="needs_attention" label={t("statuses.needs_attention")} />;
  return <StatusBadge domain="pack" status={p.status} label={t(`statuses.${p.status}`)} />;
}

/* ------------------------------------------------------------------ dialogs */

export function DeletePacksDialog({
  packs,
  onOpenChange,
  onDone,
}: {
  packs: PackTarget[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("packs.delete");
  const single = packs.length === 1 ? packs[0] : null;
  return (
    <ConfirmDialog
      open={packs.length > 0}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Trash2 />}
      title={single ? t("title", { name: single.name }) : t("titleMany", { count: packs.length })}
      impact={[t("impactPending"), t("impactRefused"), t("impactServices")]}
      confirmLabel={t("confirm")}
      onConfirm={async () => {
        const refused: string[] = [];
        let cancelled = 0;
        for (const p of packs) {
          try {
            cancelled += (await deletePack(p.id)).cancelledBookings;
          } catch (e) {
            if (e instanceof ApiError && e.code === "PACK_HAS_BOOKINGS") {
              if (single) throw new Error(t("hasBookings"));
              refused.push(p.name);
            } else throw e;
          }
        }
        onDone();
        if (refused.length)
          toast.error(t("refusedMany", { count: refused.length }), { description: refused.join(", ") });
        else
          toast.success(single ? t("done", { name: single.name }) : t("doneMany", { count: packs.length }), {
            description: cancelled ? t("cancelled", { count: cancelled }) : undefined,
          });
      }}
    />
  );
}

export function UnpublishPacksDialog({
  packs,
  onOpenChange,
  onDone,
}: {
  packs: PackTarget[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("packs.unpublish");
  const single = packs.length === 1 ? packs[0] : null;
  return (
    <ConfirmDialog
      open={packs.length > 0}
      onOpenChange={onOpenChange}
      icon={<EyeOff />}
      tone="warning"
      title={single ? t("title", { name: single.name }) : t("titleMany", { count: packs.length })}
      description={t("description")}
      confirmLabel={t("confirm")}
      onConfirm={async () => {
        for (const p of packs) await packAction(p.id, "unpublish");
        onDone();
        toast.success(single ? t("done", { name: single.name }) : t("doneMany", { count: packs.length }), {
          action: {
            label: t("undo"),
            onClick: () =>
              void Promise.all(packs.map((p) => packAction(p.id, "publish")))
                .then(onDone)
                .catch((e) => toast.apiError(e)),
          },
        });
      }}
    />
  );
}

export async function publishPack(
  pack: PackTarget,
  t: (key: string, values?: Record<string, string | number>) => string,
  onDone: () => void,
) {
  try {
    await packAction(pack.id, "publish");
    toast.success(t("publishedToast", { name: pack.name }));
  } catch (e) {
    if (e instanceof ApiError && e.code === "PACK_PUBLISH_INVALID") {
      const missing = ((e.details as { missing?: string[] })?.missing ?? []).map((m) => t(`checklist.${m}`));
      toast.error(t("publishInvalid"), { description: missing.join(" · ") });
    } else toast.apiError(e);
  } finally {
    onDone();
  }
}

export async function duplicatePack(
  pack: PackTarget,
  t: (key: string, values?: Record<string, string | number>) => string,
  onCreated: (id: string) => void,
) {
  try {
    const copy = await packAction(pack.id, "duplicate");
    toast.success(t("duplicated", { name: pack.name }));
    onCreated(copy.id);
  } catch (e) {
    toast.apiError(e);
  }
}

/* ------------------------------------------------------------------ PCK-01 */

export function PacksScreen() {
  const t = useTranslations("packs");
  const tp = useTranslations("pages.packs");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const [deleting, setDeleting] = useState<{ rows: PackTarget[]; clear?: () => void } | null>(null);
  const [unpublishing, setUnpublishing] = useState<{ rows: PackTarget[]; clear?: () => void } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: packKeys.all });

  const stats = useQuery({ queryKey: [...packKeys.all, "stats"], queryFn: () => listPacks({ limit: 1 }) });
  const counts = stats.data?.meta.counts;
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));
  // Status cards (Figma PCK-01) select the matching tab; counters come from `meta.counts`.
  const [{ tab }, setListUrl] = useQueryStates(
    { tab: parseAsString, page: parseAsString },
    { history: "replace" },
  );
  const statCards: QuickFilterItem[] = (
    [
      ["published", "green"],
      ["draft", "gray"],
      ["unpublished", "gray"],
      ["needs_attention", "red"],
    ] as const
  ).map(([key, tone]) => ({
    key,
    label: t(`stats.${key}`),
    value: v(counts?.[key]),
    hint: t(`stats.${key}Hint`),
    tone,
    filter: {},
  }));
  const target = (p: PackRow): PackTarget => ({
    id: p.id,
    name: localPackName(p, locale),
    bookingsCount: p.bookingsCount,
  });
  const eventTypeOptions = EVENT_TYPES.map((e) => ({ value: e, label: t(`eventTypes.${e}`) }));

  const filters: FilterConfig[] = [
    { key: "provider", label: t("filters.provider"), options: catalog.providerOptions },
    { key: "eventType", label: t("filters.eventType"), options: eventTypeOptions },
    { key: "wilaya", label: t("filters.wilaya"), options: catalog.wilayaOptions, multiple: true },
    {
      key: "price",
      label: t("filters.price"),
      options: [
        { value: "..100000", label: t("filters.priceUnder", { amount: "100 000" }) },
        { value: "100000..300000", label: "100 000 – 300 000" },
        { value: "300000..", label: t("filters.priceOver", { amount: "300 000" }) },
      ],
      format: (val) => {
        const [from = "", to = ""] = String(val).split("..");
        return from && to ? `${from} – ${to} DA` : from ? `≥ ${from} DA` : `≤ ${to} DA`;
      },
    },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    { key: "provider", label: t("filters.provider"), type: "select", options: catalog.providerOptions },
    { key: "eventType", label: t("filters.eventType"), type: "select", options: eventTypeOptions },
    {
      key: "wilaya",
      label: t("filters.wilaya"),
      type: "multiselect",
      display: "dropdown",
      options: catalog.wilayaOptions,
    },
    { key: "price", label: t("filters.priceRange"), type: "range", suffix: "DA" },
  ];

  const columns: DataColumn<PackRow>[] = [
    {
      id: "name",
      header: t("columns.pack"),
      sortable: true,
      hideable: false,
      cell: (p) => (
        <EntityCell
          thumb={p.coverUrl}
          icon={<Layers />}
          href={`/packs/${p.id}`}
          title={localPackName(p, locale)}
          sub={[
            t("servicesCount", { count: p.itemsCount }),
            [
              ...new Set(
                p.itemsSummary.map((c) => localName({ nameEn: c.nameEn, nameAr: c.nameAr }, locale)),
              ),
            ].join(", "),
          ].join(" · ")}
        />
      ),
    },
    {
      id: "provider",
      header: t("columns.provider"),
      cell: (p) => (
        <LinkCell
          href={`/users/${p.provider.id}`}
          label={p.provider.businessName ?? p.provider.fullName}
          sub={p.provider.businessName ? p.provider.fullName : undefined}
        />
      ),
    },
    {
      id: "price",
      header: t("columns.price"),
      sortable: true,
      cell: (p) => (
        <MoneyCell
          value={p.price}
          subTone={Number(p.savings) > 0 ? "green" : "muted"}
          sub={
            Number(p.savings) > 0
              ? t("saves", { amount: formatMoney(p.savings, locale), percent: p.savingsPercent })
              : t("noSavings")
          }
        />
      ),
    },
    {
      id: "eventType",
      header: t("columns.eventType"),
      cell: (p) => <span className="text-13 text-ink">{t(`eventTypes.${p.eventType}`)}</span>,
    },
    {
      id: "rating",
      header: t("columns.rating"),
      sortable: true,
      cell: (p) => <RatingCell value={p.rating} count={p.ratingCount} />,
    },
    {
      id: "bookingsCount",
      header: t("columns.bookings"),
      sortable: true,
      cell: (p) => <span className="text-13 tabular-nums">{formatNumber(p.bookingsCount, locale)}</span>,
    },
    { id: "status", header: t("columns.status"), cell: (p) => <PackStatusCell p={p} /> },
  ];

  const rowMenu = (p: PackRow) => [
    [
      { icon: <Eye />, label: t("menu.open"), href: `/packs/${p.id}` },
      { icon: <UserRound />, label: t("menu.openProvider"), href: `/users/${p.provider.id}` },
    ],
    [
      { icon: <Pencil />, label: t("menu.edit"), href: `/packs/${p.id}/edit` },
      p.status === "published"
        ? {
            icon: <EyeOff />,
            label: t("menu.unpublish"),
            onSelect: () => setUnpublishing({ rows: [target(p)] }),
          }
        : {
            icon: <Send />,
            label: t("menu.publish"),
            onSelect: () => void publishPack(target(p), t, () => void invalidate()),
          },
      {
        icon: <Copy />,
        label: t("menu.duplicate"),
        onSelect: () =>
          void duplicatePack(target(p), t, (id) => {
            void invalidate();
            router.push(`/packs/${id}/edit`);
          }),
      },
    ],
    [
      {
        icon: <Trash2 />,
        label: t("menu.delete"),
        danger: true,
        onSelect: () => setDeleting({ rows: [target(p)] }),
      },
    ],
  ];

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
            <Button icon={<Plus />} onClick={() => router.push("/packs/new")}>
              {t("createPack")}
            </Button>
          </>
        }
      />
      <QuickFilterCards
        className="mb-4"
        items={statCards}
        isActive={(it) => tab === it.key}
        onSelect={(it) => void setListUrl({ tab: tab === it.key ? null : it.key, page: null })}
      />
      <DataList<PackRow>
        resource={packKeys.all}
        queryFn={(p) => listPacks(packsQuery(p))}
        columns={columns}
        getRowId={(p) => p.id}
        tabs={[
          { key: "all", label: t("tabs.all") },
          { key: "published", label: t("tabs.published") },
          { key: "draft", label: t("tabs.draft") },
          { key: "unpublished", label: t("tabs.unpublished") },
          { key: "needs_attention", label: t("tabs.needs_attention") },
        ]}
        tabCounts={(r) => (r as PackList).meta.counts as unknown as Record<string, number>}
        defaultTab="all"
        filters={filters}
        advancedFilters={advancedFilters}
        sortOptions={[
          { value: "createdAt:desc", label: t("sort.newest") },
          { value: "bookingsCount:desc", label: t("sort.mostBooked") },
          { value: "rating:desc", label: t("sort.rating") },
          { value: "price:asc", label: t("sort.priceLow") },
          { value: "price:desc", label: t("sort.priceHigh") },
          { value: "name:asc", label: t("sort.name") },
        ]}
        defaultSort="createdAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("packs")}
        columnsStorageKey="packs"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(p) => router.push(`/packs/${p.id}`)}
        rowMenuHeader={(p) => ({
          title: localPackName(p, locale),
          subtitle: [p.provider.businessName ?? p.provider.fullName, t(`eventTypes.${p.eventType}`)].join(
            " · ",
          ),
        })}
        rowMenu={rowMenu}
        bulkActions={(rows, clear) => (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<EyeOff />}
              disabled={!rows.some((r) => r.status === "published")}
              onClick={() =>
                setUnpublishing({ rows: rows.filter((r) => r.status === "published").map(target), clear })
              }
            >
              {t("bulk.unpublish")}
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              icon={<Trash2 />}
              onClick={() => setDeleting({ rows: rows.map(target), clear })}
            >
              {t("bulk.delete")}
            </Button>
          </>
        )}
        emptyState={
          <EmptyState
            icon={<Layers />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="add" icon={<Plus />} onClick={() => router.push("/packs/new")}>
                {t("createPack")}
              </Button>,
            ]}
          />
        }
      />
      <DeletePacksDialog
        packs={deleting?.rows ?? []}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDone={() => {
          deleting?.clear?.();
          void invalidate();
        }}
      />
      <UnpublishPacksDialog
        packs={unpublishing?.rows ?? []}
        onOpenChange={(o) => !o && setUnpublishing(null)}
        onDone={() => {
          unpublishing?.clear?.();
          void invalidate();
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="packs"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(stats.data?.meta.total ?? 0, locale),
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "nameEn", label: t("exportColumns.nameEn") },
          { key: "nameAr", label: t("exportColumns.nameAr") },
          { key: "provider", label: t("exportColumns.provider") },
          { key: "itemsCount", label: t("exportColumns.itemsCount") },
          { key: "price", label: t("exportColumns.price") },
          { key: "sumOfItems", label: t("exportColumns.sumOfItems") },
          { key: "savings", label: t("exportColumns.savings") },
          { key: "eventType", label: t("exportColumns.eventType") },
          { key: "wilaya", label: t("exportColumns.wilaya") },
          { key: "bookingsCount", label: t("exportColumns.bookingsCount") },
          { key: "status", label: t("exportColumns.status") },
          { key: "createdAt", label: t("exportColumns.createdAt"), defaultChecked: false },
        ]}
      />
    </>
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = packsQuery(p);
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
