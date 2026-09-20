"use client";

import {
  createColumnHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { useMemo, type HTMLAttributes, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { Checkbox } from "@/components/forms/fields";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";

const features = tableFeatures({ rowSortingFeature, rowSelectionFeature });

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  /** false → always shown (ColumnsMenu can't hide it). Default true. */
  hideable?: boolean;
  /** Plain label for ColumnsMenu when `header` isn't text. */
  menuLabel?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T extends object> {
  data: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  selectable?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  rowHref?: (row: T) => string;
  rowMenu?: (row: T) => ActionMenuItem[][];
  rowMenuHeader?: (row: T) => { title: ReactNode; subtitle?: ReactNode };
  /** Dims rows while refetching (STA-03). */
  dimmed?: boolean;
  /** Rendered instead of the body when there are no rows (empty / no results / loading / error). */
  bodyOverride?: ReactNode;
  /** Extra <tr> attributes, e.g. drag-and-drop handlers (CAT-01 reorder). */
  rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement> & Record<`data-${string}`, string | undefined>;
}

export function DataTable<T extends object>({
  data,
  columns,
  getRowId,
  sorting,
  onSortingChange,
  selectable = false,
  rowSelection = {},
  onRowSelectionChange,
  rowHref,
  rowMenu,
  rowMenuHeader,
  dimmed,
  bodyOverride,
  rowProps,
}: DataTableProps<T>) {
  const t = useTranslations("dataList");
  const router = useRouter();

  const columnDefs = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    const defs: ColumnDef<typeof features, T, unknown>[] = [];
    if (selectable) {
      defs.push(
        helper.display({
          id: "__select",
          enableSorting: false,
          header: ({ table }) => (
            <Checkbox
              aria-label={t("selectAll")}
              checked={
                table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(v)}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label={t("selectRow")}
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(v)}
            />
          ),
        }) as ColumnDef<typeof features, T, unknown>,
      );
    }
    for (const col of columns) {
      defs.push(
        // accessor (not display) so the column can sort; sorting itself is server-side
        helper.accessor((row) => (row as Record<string, unknown>)[col.id], {
          id: col.id,
          enableSorting: !!col.sortable,
          header: () => col.header,
          cell: ({ row }) => col.cell(row.original),
        }) as ColumnDef<typeof features, T, unknown>,
      );
    }
    return defs;
  }, [columns, selectable, t]);

  const table = useTable({
    features,
    columns: columnDefs,
    data,
    getRowId: (row) => getRowId(row),
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    sortDescFirst: false,
    state: { sorting, rowSelection },
    onSortingChange: (updater) => onSortingChange(typeof updater === "function" ? updater(sorting) : updater),
    onRowSelectionChange: (updater) =>
      onRowSelectionChange?.(typeof updater === "function" ? updater(rowSelection) : updater),
    enableRowSelection: selectable,
  });

  const colCount = columnDefs.length + (rowMenu ? 1 : 0);

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-13">
        <thead className="sticky top-0 z-10 bg-[#FAFAFB]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-y border-border">
              {hg.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                const colCfg = columns.find((c) => c.id === header.column.id);
                const isSelect = header.column.id === "__select";
                const label = <table.FlexRender header={header} />;
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                    className={cn(
                      "h-10 px-4 text-start text-11 font-medium tracking-[0.06em] whitespace-nowrap text-muted uppercase",
                      isSelect && "w-10 pe-0",
                      dir && "text-brand",
                      colCfg?.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 uppercase hover:text-ink"
                      >
                        {label}
                        {dir === "asc" ? (
                          <ChevronUp aria-hidden className="size-3.5" />
                        ) : (
                          <ChevronDown aria-hidden className={cn("size-3.5", !dir && "opacity-60")} />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
              {rowMenu && (
                <th scope="col" className="w-12">
                  <span className="sr-only">{t("rowActions")}</span>
                </th>
              )}
            </tr>
          ))}
        </thead>
        <tbody className={cn("transition-opacity", dimmed && "opacity-60")}>
          {bodyOverride ? (
            <tr>
              <td colSpan={colCount} className="p-0">
                {bodyOverride}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => {
              const href = rowHref?.(row.original);
              const extra = rowProps?.(row.original) ?? {};
              return (
                <tr
                  key={row.id}
                  {...extra}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={
                    href
                      ? (e) => {
                          if ((e.target as HTMLElement).closest("a,button,input,[role=checkbox],[role=menu]"))
                            return;
                          router.push(href);
                        }
                      : extra.onClick
                  }
                  className={cn(
                    "h-[59px] border-b border-border transition-colors last:border-b-0 hover:bg-[#FBFAFD] data-[state=selected]:bg-[#F8F5FC]",
                    href && "cursor-pointer",
                    extra.className,
                  )}
                >
                  {row.getAllCells().map((cell) => {
                    const colCfg = columns.find((c) => c.id === cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "max-w-[320px] truncate px-4 text-ink",
                          cell.column.id === "__select" && "w-10 pe-0",
                          colCfg?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                  {rowMenu && (
                    <td className="w-12 pe-3 text-end">
                      <ActionMenu
                        header={rowMenuHeader?.(row.original)}
                        groups={rowMenu(row.original)}
                        trigger={
                          <button
                            type="button"
                            aria-label={t("rowActions")}
                            className="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-gray-soft data-[state=open]:border data-[state=open]:border-brand/30 data-[state=open]:bg-brand-soft"
                          >
                            <MoreHorizontal aria-hidden className="size-[18px]" />
                          </button>
                        }
                      />
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
