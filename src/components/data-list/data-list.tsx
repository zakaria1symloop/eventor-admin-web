"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { ActionMenuItem } from "@/components/ui/action-menu";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import type { ListResponse } from "@/lib/api/client";
import { BulkBar } from "./bulk-bar";
import { DataTable, type DataColumn, type DataTableProps } from "./data-table";
import { DebouncedSearch, FilterBar, FilterChips, FilterSelect, SortSelect } from "./filter-bar";
import { Pagination } from "./pagination";
import { parseSort, useListState, type FilterConfig, type ListParams } from "./use-list-state";
import {
  AdvancedFiltersDrawer,
  advancedToFilterConfigs,
  type AdvancedFilterField,
  type FilterValues,
} from "./advanced-filters-drawer";
import {
  ColumnsMenu,
  QuickFilterCards,
  quickFilterMatches,
  SavedViewsMenu,
  SaveViewDialog,
  useColumnVisibility,
  type QuickFilterItem,
  type SavedView,
  type SavedViewsSource,
} from "./list-extras";

export interface DataListProps<T extends object> {
  /** Query key prefix for this resource (one factory per resource). */
  resource: readonly unknown[];
  queryFn: (params: ListParams) => Promise<ListResponse<T>>;
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  tabs?: TabItem[];
  defaultTab?: string;
  /** Up to 4 FilterSelects. */
  filters?: FilterConfig[];
  sortOptions?: { value: string; label: string }[];
  defaultSort?: string;
  defaultLimit?: number;
  searchPlaceholder?: string;
  rowHref?: (row: T) => string;
  rowMenu?: (row: T) => ActionMenuItem[][];
  rowMenuHeader?: (row: T) => { title: ReactNode; subtitle?: ReactNode };
  bulkActions?: (selected: T[], clearSelection: () => void) => ReactNode;
  /** STA-01: tab has 0 rows and no filters. */
  emptyState?: ReactNode;
  /** Custom "More filters" handler; defaults to the AdvancedFiltersDrawer when `advancedFilters` is set. */
  onMoreFilters?: () => void;
  /** AdvancedFiltersDrawer fields; values live in the URL like `filters`. */
  advancedFilters?: AdvancedFilterField[];
  /** Live "Show N results" count; defaults to queryFn(page 1, limit 1).meta.total. */
  countFn?: (params: ListParams) => Promise<number>;
  /** Cards above the list; clicking applies (or clears) their filter. */
  quickFilters?: QuickFilterItem[];
  savedViews?: SavedViewsSource;
  /** Enables ColumnsMenu; hidden columns persisted in localStorage under this key. */
  columnsStorageKey?: string;
  itemLabel?: string;
  /** Tab counters from the list response (e.g. `meta.counts`), shown as tab chips. */
  tabCounts?: (response: ListResponse<T>) => Record<string, number> | undefined;
  /** Extra <tr> attributes (drag reorder). */
  rowProps?: DataTableProps<T>["rowProps"];
  /** Row click handler for rows that open a drawer instead of a route. */
  onRowClick?: (row: T) => void;
  /** Text under the table (Figma: "9 categories · changes apply within a minute"). */
  footer?: (response: ListResponse<T>) => ReactNode;
  /** Called whenever the URL list params change (export dialog, reorder). */
  onParamsChange?: (params: ListParams) => void;
  /** Hide pagination (short, fully loaded lists). */
  hidePagination?: boolean;
}

export function DataList<T extends object>({
  resource,
  queryFn,
  columns,
  getRowId,
  tabs,
  defaultTab = tabs?.[0]?.key ?? "",
  filters = [],
  sortOptions,
  defaultSort = "",
  defaultLimit = 10,
  searchPlaceholder,
  rowHref,
  rowMenu,
  rowMenuHeader,
  bulkActions,
  emptyState,
  onMoreFilters,
  advancedFilters,
  countFn,
  quickFilters,
  savedViews,
  columnsStorageKey,
  itemLabel,
  tabCounts,
  rowProps,
  onRowClick,
  footer,
  onParamsChange,
  hidePagination,
}: DataListProps<T>) {
  const ts = useTranslations("states");
  const tf = useTranslations("filters");

  const advancedConfigs = useMemo(
    () =>
      advancedFilters ? advancedToFilterConfigs(advancedFilters, { yes: tf("yes"), any: tf("any") }) : [],
    [advancedFilters, tf],
  );
  const allFilters = useMemo(() => {
    const keys = new Set(filters.map((f) => f.key));
    return [...filters, ...advancedConfigs.filter((f) => !keys.has(f.key))];
  }, [filters, advancedConfigs]);
  const advancedKeys = useMemo(() => advancedConfigs.map((f) => f.key), [advancedConfigs]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDraft, setSaveDraft] = useState<FilterValues | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useColumnVisibility(columnsStorageKey ?? "");
  const visibleColumns = useMemo(
    () =>
      columnsStorageKey
        ? columns.filter((c) => c.hideable === false || !hiddenColumns.includes(c.id))
        : columns,
    [columns, hiddenColumns, columnsStorageKey],
  );

  const { params, set, setFilter, clearFilters, hasActiveFilters } = useListState({
    filters: allFilters,
    defaultTab,
    defaultSort,
    defaultLimit,
  });

  const paramsJson = JSON.stringify(params);
  useEffect(() => {
    onParamsChange?.(JSON.parse(paramsJson) as ListParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsJson]);

  const query = useQuery({
    queryKey: [...resource, "list", params],
    queryFn: () => queryFn(params),
    placeholderData: keepPreviousData,
  });

  // Selection is scoped to the current query; it resets when params change.
  const paramsKey = JSON.stringify(params);
  const [selection, setSelection] = useState<{ key: string; rows: RowSelectionState }>({
    key: paramsKey,
    rows: {},
  });
  const rowSelection = useMemo(
    () => (selection.key === paramsKey ? selection.rows : {}),
    [selection, paramsKey],
  );
  const setRowSelection = (rows: RowSelectionState) => setSelection({ key: paramsKey, rows });
  const clearSelection = () => setRowSelection({});

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const selectedRows = useMemo(
    () => rows.filter((r) => rowSelection[getRowId(r)]),
    [rows, rowSelection, getRowId],
  );

  const sort = parseSort(params.sort);
  const sorting: SortingState = sort ? [sort] : [];

  let bodyOverride: ReactNode = null;
  if (query.isPending) {
    bodyOverride = (
      <TableSkeleton rows={Math.min(params.limit, 8)} columns={Math.min(visibleColumns.length, 5)} />
    );
  } else if (query.isError && !query.data) {
    bodyOverride = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (rows.length === 0) {
    bodyOverride = hasActiveFilters ? (
      <EmptyState
        icon={<Search />}
        title={ts("noResultsTitle")}
        actions={[
          <Button key="clear" onClick={clearFilters}>
            {ts("clearFilters")}
          </Button>,
        ]}
      />
    ) : (
      (emptyState ?? <EmptyState title={ts("emptyTitle")} />)
    );
  }

  /* ---------------- advanced filters / views */

  const advancedValues: FilterValues = Object.fromEntries(
    Object.entries(params.filters).filter(([k]) => advancedKeys.includes(k)),
  );

  function withAdvanced(values: FilterValues): ListParams["filters"] {
    const f: ListParams["filters"] = { ...params.filters };
    for (const k of advancedKeys) {
      if (values[k] === undefined) delete f[k];
      else f[k] = values[k];
    }
    return f;
  }

  function applyAdvanced(values: FilterValues) {
    const patch: Record<string, string | string[] | null> = {};
    for (const k of advancedKeys) patch[k] = values[k] ?? null;
    set(patch);
    setActiveViewId(null);
  }

  function currentQuery(draft: FilterValues | null): Record<string, string | string[]> {
    const q: Record<string, string | string[]> = draft ? withAdvanced(draft) : { ...params.filters };
    if (params.q) q.q = params.q;
    if (params.sort && params.sort !== defaultSort) q.sort = params.sort;
    if (params.tab && params.tab !== defaultTab) q.tab = params.tab;
    return q;
  }

  function applyView(view: SavedView) {
    const patch: Record<string, unknown> = { q: null, sort: null, tab: null };
    for (const f of allFilters) patch[f.key] = null;
    for (const [k, v] of Object.entries(view.query)) {
      if (k in patch) patch[k] = v;
    }
    set(patch);
    setActiveViewId(view.id);
  }

  const openDrawer = onMoreFilters ?? (advancedFilters ? () => setDrawerOpen(true) : undefined);
  const count =
    countFn ?? ((p: ListParams) => queryFn({ ...p, page: 1, limit: 1 }).then((r) => r.meta.total));

  const hasEnd = (sortOptions && sortOptions.length > 0) || !!savedViews || !!columnsStorageKey;
  const endControls = hasEnd ? (
    <>
      {savedViews && (
        <SavedViewsMenu
          source={savedViews}
          activeViewId={activeViewId}
          onApply={applyView}
          onSaveCurrent={() => {
            setSaveDraft(null);
            setSaveOpen(true);
          }}
        />
      )}
      {sortOptions && sortOptions.length > 0 && (
        <SortSelect
          value={params.sort}
          options={sortOptions}
          onChange={(v) => set({ sort: v === defaultSort ? null : v })}
        />
      )}
      {columnsStorageKey && (
        <ColumnsMenu
          columns={columns.map((c) => ({ id: c.id, label: c.menuLabel ?? c.header, hideable: c.hideable }))}
          hidden={hiddenColumns}
          onChange={setHiddenColumns}
        />
      )}
    </>
  ) : undefined;

  return (
    <>
      {quickFilters && quickFilters.length > 0 && (
        <QuickFilterCards
          items={quickFilters}
          isActive={(it) => quickFilterMatches(it.filter, params.filters)}
          onSelect={(it) => {
            const active = quickFilterMatches(it.filter, params.filters);
            const patch: Record<string, string | string[] | null> = {};
            for (const [k, v] of Object.entries(it.filter)) patch[k] = active ? null : v;
            set(patch);
            setActiveViewId(null);
          }}
        />
      )}
      <Card className="overflow-hidden">
        {tabs && tabs.length > 0 && (
          <Tabs
            items={(() => {
              const counts = query.data && tabCounts ? tabCounts(query.data) : undefined;
              return counts ? tabs.map((t) => ({ ...t, count: counts[t.key] ?? t.count })) : tabs;
            })()}
            value={params.tab}
            onChange={(tab) => set({ tab: tab === defaultTab ? null : tab })}
          />
        )}
        <FilterBar
          search={
            <DebouncedSearch
              value={params.q}
              placeholder={searchPlaceholder}
              onChange={(q) => set({ q: q || null })}
            />
          }
          filters={filters.slice(0, 4).map((f) => (
            <FilterSelect
              key={f.key}
              filter={f}
              value={params.filters[f.key]}
              onChange={(v) => setFilter(f.key, v)}
            />
          ))}
          moreFilters={openDrawer}
          moreFiltersCount={Object.keys(advancedValues).length}
          end={endControls}
        />
        <FilterChips
          filters={allFilters}
          values={params.filters}
          onRemove={(key) => setFilter(key, null)}
          onClearAll={clearFilters}
          onSaveView={
            savedViews
              ? () => {
                  setSaveDraft(null);
                  setSaveOpen(true);
                }
              : undefined
          }
        />
        {bulkActions && (
          <BulkBar count={selectedRows.length} onClear={clearSelection}>
            {bulkActions(selectedRows, clearSelection)}
          </BulkBar>
        )}
        <DataTable
          data={rows}
          columns={visibleColumns}
          getRowId={getRowId}
          sorting={sorting}
          onSortingChange={(s) => {
            const first = s[0];
            set({ sort: first ? `${first.id}:${first.desc ? "desc" : "asc"}` : null });
          }}
          selectable={!!bulkActions}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          rowHref={rowHref}
          rowMenu={rowMenu}
          rowMenuHeader={rowMenuHeader}
          dimmed={query.isFetching && !query.isPending}
          bodyOverride={bodyOverride}
          rowProps={
            onRowClick
              ? (row) => {
                  const extra = rowProps?.(row) ?? {};
                  return {
                    ...extra,
                    className: [extra.className, "cursor-pointer"].filter(Boolean).join(" "),
                    onClick: (e) => {
                      if (
                        (e.target as HTMLElement).closest(
                          "a,button,input,[role=checkbox],[role=menu],[role=switch]",
                        )
                      )
                        return;
                      onRowClick(row);
                    },
                  };
                }
              : rowProps
          }
        />
        {query.data && footer && (
          <div className="border-t border-border px-4 py-3 text-13 text-muted">{footer(query.data)}</div>
        )}
        {!hidePagination && query.data && query.data.meta.total > 0 && (
          <div className="border-t border-border">
            <Pagination
              page={params.page}
              limit={params.limit}
              total={query.data.meta.total}
              itemLabel={itemLabel}
              onPageChange={(page) => set({ page: page === 1 ? null : page }, { resetPage: false })}
              onLimitChange={(limit) => set({ limit: limit === defaultLimit ? null : limit })}
            />
          </div>
        )}
      </Card>
      {advancedFilters && (
        <AdvancedFiltersDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          fields={advancedFilters}
          values={advancedValues}
          onApply={applyAdvanced}
          countKey={[...resource, "count", params.q, params.tab, params.filters]}
          countFn={(values) => count({ ...params, filters: withAdvanced(values) })}
          itemLabel={itemLabel}
          onSaveView={
            savedViews
              ? (values) => {
                  setSaveDraft(values);
                  setSaveOpen(true);
                }
              : undefined
          }
        />
      )}
      {savedViews && (
        <SaveViewDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          onSave={async ({ name, isShared }) => {
            await savedViews.onSave({ name, isShared, query: currentQuery(saveDraft) });
            if (saveDraft) {
              applyAdvanced(saveDraft);
              setDrawerOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
