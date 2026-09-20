"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  BilingualCell,
  CountLinkCell,
  DataList,
  DragHandleCell,
  ToggleCell,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { EmptyState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  categoryKeys,
  listCategories,
  reorderCategories,
  updateCategory,
  type Category,
  type CountedList,
} from "@/lib/api/catalog";
import { savedViewsSource } from "@/lib/api/saved-views";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import { CategoryFormDialog, DeleteCategoryDialog } from "./category-dialogs";
import { CategoryIcon } from "./category-icons";

const MAX = 100;

/** Moves `id` before/after `targetId` and returns the new id order. */
export function moveId(ids: string[], id: string, targetId: string): string[] {
  if (id === targetId) return ids;
  const from = ids.indexOf(id);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function CategoriesScreen() {
  const t = useTranslations("categories");
  const tp = useTranslations("pages.categories");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useQueryStates(
    { edit: parseAsString, new: parseAsString, focus: parseAsString },
    { history: "replace" },
  );
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Whole catalogue (≤ 100): quick stats, move targets, edit lookup.
  const all = useQuery({
    queryKey: [...categoryKeys.all, "all"],
    queryFn: () => listCategories({ limit: MAX, sort: "position:asc" }),
  });
  const allRows = all.data?.data ?? [];
  const editing = dialog.edit ? (allRows.find((c) => c.id === dialog.edit) ?? null) : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: categoryKeys.all });

  const listKey = params ? [...categoryKeys.all, "list", params] : null;
  const canReorder =
    !!params &&
    !params.q &&
    (params.sort === "" || params.sort === "position:asc") &&
    Object.keys(params.filters).length === 0;

  async function drop(targetId: string) {
    const id = dragId;
    setDragId(null);
    setOverId(null);
    if (!id || !listKey || id === targetId) return;
    const current = queryClient.getQueryData<CountedList<Category>>(listKey);
    if (!current) return;
    await applyOrder(
      moveId(
        current.data.map((c) => c.id),
        id,
        targetId,
      ),
    );
  }

  async function applyOrder(ids: string[]) {
    if (!listKey) return;
    const current = queryClient.getQueryData<CountedList<Category>>(listKey);
    if (!current) return;
    const byId = new Map(current.data.map((c) => [c.id, c]));
    queryClient.setQueryData<CountedList<Category>>(listKey, {
      ...current,
      data: ids.map((i) => byId.get(i)!).filter(Boolean),
    });
    try {
      await reorderCategories(ids);
      toast.success(t("orderSaved"));
    } catch (e) {
      queryClient.setQueryData(listKey, current);
      toast.apiError(e);
    } finally {
      void invalidate();
    }
  }

  function moveByKey(id: string, delta: number) {
    if (!listKey) return;
    const current = queryClient.getQueryData<CountedList<Category>>(listKey);
    if (!current) return;
    const ids = current.data.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    void applyOrder(moveId(ids, id, ids[j]));
  }

  const name = (c: Category) => c.nameEn || c.nameAr;

  // Not memoised: cells close over the current list key (reorder).
  const columns: DataColumn<Category>[] = [
    {
      id: "position",
      header: <span className="sr-only">{t("columns.order")}</span>,
      menuLabel: t("columns.order"),
      hideable: false,
      headerClassName: "w-10 pe-0",
      className: "w-10 pe-0",
      cell: (c) => (
        <DragHandleCell
          draggable={canReorder}
          disabled={!canReorder}
          label={t("dragLabel", { name: name(c) })}
          title={canReorder ? undefined : t("reorderDisabled")}
          className={cn(!canReorder && "cursor-not-allowed opacity-40")}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", c.id);
            setDragId(c.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          onKeyDown={(e) => {
            if (!canReorder) return;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              moveByKey(c.id, -1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              moveByKey(c.id, 1);
            }
          }}
        />
      ),
    },
    {
      id: "nameEn",
      header: t("columns.category"),
      sortable: true,
      hideable: false,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            <CategoryIcon name={c.icon} className="size-4" />
          </span>
          <span className="min-w-0 leading-tight">
            {c.nameEn ? (
              <span className="block truncate text-14 font-medium text-ink">{c.nameEn}</span>
            ) : (
              <button
                type="button"
                onClick={() => void setDialog({ edit: c.id, focus: "en" })}
                className="block text-13 font-medium text-red hover:underline"
              >
                {t("missingEnglish")}
              </button>
            )}
            {c.descriptionEn && <span className="block truncate text-12 text-muted">{c.descriptionEn}</span>}
          </span>
        </div>
      ),
    },
    {
      id: "nameAr",
      header: t("columns.arabicName"),
      sortable: true,
      cell: (c) => (
        <BilingualCell ar={c.nameAr} onMissingClick={() => void setDialog({ edit: c.id, focus: "ar" })} />
      ),
    },
    {
      id: "servicesCount",
      header: t("columns.services"),
      cell: (c) => (
        <CountLinkCell
          count={c.servicesCount}
          href={`/services?category=${c.id}`}
          label={(n) => t("servicesCount", { count: n })}
        />
      ),
    },
    {
      id: "providersCount",
      header: t("columns.providers"),
      cell: (c) => (
        <CountLinkCell
          count={c.providersCount}
          href={`/users?tab=providers&category=${c.id}`}
          label={(n) => t("providersCount", { count: n })}
        />
      ),
    },
    {
      id: "bookings30dCount",
      header: t("columns.bookings30d"),
      cell: (c) => (
        <CountLinkCell
          count={c.bookings30dCount}
          href={`/bookings?category=${c.id}&created=30d`}
          label={(n) => formatNumber(n, locale)}
        />
      ),
    },
    {
      id: "isVisible",
      header: t("columns.shown"),
      cell: (c) => (
        <ToggleCell
          checked={c.isVisible}
          label={t("toggleLabel", { name: name(c) })}
          confirm={(next) =>
            !next && c.servicesCount > 0
              ? {
                  tone: "warning",
                  title: t("hideTitle", { name: name(c) }),
                  description: t("hideDescription", { count: c.servicesCount }),
                  impact: [t("hideImpact1"), t("hideImpact2")],
                  confirmLabel: t("hide"),
                }
              : null
          }
          onChange={async (next) => {
            await updateCategory(c.id, { isVisible: next });
            void invalidate();
          }}
          successMessage={(next) => (next ? t("shown", { name: name(c) }) : t("hidden", { name: name(c) }))}
        />
      ),
    },
  ];

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        key: "translation",
        label: t("filters.translation"),
        options: [
          { value: "missing", label: t("filters.missing") },
          { value: "complete", label: t("filters.complete") },
        ],
      },
      {
        key: "usage",
        label: t("filters.usage"),
        options: [
          { value: "empty", label: t("filters.empty") },
          { value: "used", label: t("filters.used") },
        ],
      },
    ],
    [t],
  );

  const shown = allRows.filter((c) => c.isVisible).length;
  const services = allRows.reduce((s, c) => s + c.servicesCount, 0);
  const missingAr = allRows.filter((c) => !c.nameAr?.trim()).length;
  const empty = allRows.filter((c) => c.servicesCount === 0).length;
  const v = (n: number) => (all.data ? formatNumber(n, locale) : "—");
  const quickFilters: QuickFilterItem[] = [
    {
      key: "all",
      label: t("stats.categories"),
      value: v(allRows.length),
      hint: t("stats.shownInApp", { count: shown }),
      tone: "brand",
      filter: { translation: null, usage: null },
    },
    {
      key: "services",
      label: t("stats.services"),
      value: v(services),
      hint: t("stats.acrossAll"),
      tone: "green",
      filter: { usage: "used" },
    },
    {
      key: "missing",
      label: t("stats.missingArabic"),
      value: v(missingAr),
      hint: t("stats.englishOnly"),
      tone: "red",
      filter: { translation: "missing" },
    },
    {
      key: "empty",
      label: t("stats.empty"),
      value: v(empty),
      hint: t("stats.noService"),
      tone: "gray",
      filter: { usage: "empty" },
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("setup") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
              {t("export")}
            </Button>
            <Button icon={<Plus />} onClick={() => void setDialog({ new: "1", edit: null, focus: null })}>
              {t("addCategory")}
            </Button>
          </>
        }
      />
      <DataList<Category>
        resource={categoryKeys.all}
        queryFn={async (p) => {
          // Client-side "translation" / "usage" filters: the catalogue is small (≤ 100).
          const clientFilter = p.filters.translation || p.filters.usage;
          const res = await listCategories({
            tab: p.tab === "all" ? undefined : p.tab,
            q: p.q || undefined,
            sort: p.sort || undefined,
            page: clientFilter ? 1 : p.page,
            limit: clientFilter ? MAX : p.limit,
          });
          if (!clientFilter) return res;
          const data = res.data.filter(
            (c) =>
              (!p.filters.translation || (p.filters.translation === "missing") === c.missingTranslation) &&
              (!p.filters.usage || (p.filters.usage === "empty") === (c.servicesCount === 0)),
          );
          return { data, meta: { ...res.meta, page: 1, total: data.length, totalPages: 1 } };
        }}
        columns={columns}
        getRowId={(c) => c.id}
        tabs={[
          { key: "all", label: t("tabs.all") },
          { key: "shown", label: t("tabs.shown") },
          { key: "hidden", label: t("tabs.hidden") },
        ]}
        tabCounts={(r) => (r as CountedList<Category>).meta.counts}
        defaultTab="all"
        filters={filters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "position:asc", label: t("sort.homeOrder") },
          { value: "nameEn:asc", label: t("sort.nameEn") },
          { value: "nameAr:asc", label: t("sort.nameAr") },
          { value: "createdAt:desc", label: t("sort.newest") },
        ]}
        defaultSort="position:asc"
        defaultLimit={100}
        hidePagination
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("categories")}
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        footer={(r) => t("footer", { count: r.meta.total })}
        rowProps={(c) => ({
          "data-drop-target": overId === c.id && dragId !== c.id ? "true" : undefined,
          className: cn(
            dragId === c.id && "opacity-50",
            overId === c.id && dragId !== c.id && "shadow-[inset_0_2px_0_0_var(--color-brand)]",
          ),
          onDragOver: (e) => {
            if (!dragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overId !== c.id) setOverId(c.id);
          },
          onDrop: (e) => {
            e.preventDefault();
            void drop(c.id);
          },
        })}
        rowMenuHeader={(c) => ({ title: name(c), subtitle: c.slug })}
        rowMenu={(c) => [
          [
            {
              icon: <Pencil />,
              label: t("edit"),
              onSelect: () => void setDialog({ edit: c.id, focus: null }),
            },
          ],
          [{ icon: <Trash2 />, label: t("delete"), danger: true, onSelect: () => setDeleting(c) }],
        ]}
        emptyState={
          <EmptyState
            icon={<LayoutGrid />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="add" icon={<Plus />} onClick={() => void setDialog({ new: "1" })}>
                {t("addCategory")}
              </Button>,
            ]}
          />
        }
      />

      <CategoryFormDialog
        open={dialog.new === "1" || !!editing}
        onOpenChange={(o) => !o && void setDialog({ new: null, edit: null, focus: null })}
        category={editing}
        focusLang={dialog.focus === "ar" || dialog.focus === "en" ? dialog.focus : undefined}
        onSaved={() => void invalidate()}
      />
      <DeleteCategoryDialog
        category={deleting}
        categories={allRows}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          void invalidate();
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="categories"
        title={t("exportTitle")}
        filters={{
          ...(params?.tab && params.tab !== "all" ? { tab: params.tab } : {}),
          ...(params?.q ? { q: params.q } : {}),
        }}
        summary={t("exportSummary", {
          count: all.data?.meta.total ?? 0,
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "slug", label: t("exportColumns.slug") },
          { key: "nameEn", label: t("exportColumns.nameEn") },
          { key: "nameAr", label: t("exportColumns.nameAr") },
          { key: "descriptionEn", label: t("exportColumns.descriptionEn"), defaultChecked: false },
          { key: "descriptionAr", label: t("exportColumns.descriptionAr"), defaultChecked: false },
          { key: "position", label: t("exportColumns.position") },
          { key: "isVisible", label: t("exportColumns.isVisible") },
          { key: "servicesCount", label: t("exportColumns.servicesCount") },
          { key: "providersCount", label: t("exportColumns.providersCount") },
          { key: "bookings30dCount", label: t("exportColumns.bookings30dCount"), defaultChecked: false },
        ]}
      />
    </>
  );
}
