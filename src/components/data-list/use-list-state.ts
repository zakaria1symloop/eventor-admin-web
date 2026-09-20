"use client";

import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

export const PAGE_SIZES = [10, 20, 50, 100] as const;

export interface FilterConfig {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  multiple?: boolean;
  /** Chip text for values without options (ranges, toggles). */
  format?: (value: string | string[]) => string;
}

export interface ListParams {
  q: string;
  page: number;
  limit: number;
  /** `field:dir`, e.g. `joinedAt:desc` */
  sort: string;
  tab: string;
  filters: Record<string, string | string[]>;
}

export interface UseListStateOptions {
  filters?: FilterConfig[];
  defaultTab?: string;
  defaultSort?: string;
  defaultLimit?: number;
}

/**
 * All list state (tab, q, filters, sort, page, limit) lives in the URL query string.
 * Default values are omitted from the URL (clearOnDefault).
 */
export function useListState({
  filters = [],
  defaultTab = "",
  defaultSort = "",
  defaultLimit = 10,
}: UseListStateOptions) {
  const filterKey = filters.map((f) => `${f.key}:${f.multiple ? "m" : "s"}`).join(",");

  const parsers = useMemo(() => {
    const base = {
      q: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(defaultLimit),
      sort: parseAsString.withDefault(defaultSort),
      tab: parseAsString.withDefault(defaultTab),
    };
    const dynamic: Record<
      string,
      ReturnType<typeof parseAsString.withDefault> | ReturnType<typeof parseAsArrayOf<string>>
    > = {};
    for (const f of filters) {
      dynamic[f.key] = f.multiple ? parseAsArrayOf(parseAsString) : parseAsString.withDefault("");
    }
    return { ...base, ...dynamic };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, defaultLimit, defaultSort, defaultTab]);

  const [state, setState] = useQueryStates(parsers, { history: "replace", clearOnDefault: true });

  const params: ListParams = useMemo(() => {
    const s = state as Record<string, unknown>;
    const f: Record<string, string | string[]> = {};
    for (const cfg of filters) {
      const v = s[cfg.key];
      if (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v !== "") {
        f[cfg.key] = v as string | string[];
      }
    }
    const limit = PAGE_SIZES.includes(state.limit as (typeof PAGE_SIZES)[number])
      ? state.limit
      : defaultLimit;
    return {
      q: state.q,
      page: Math.max(1, state.page),
      limit,
      sort: state.sort,
      tab: state.tab,
      filters: f,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, filterKey, defaultLimit]);

  const set = useCallback(
    (patch: Partial<Record<string, unknown>>, { resetPage = true } = {}) => {
      void setState({
        ...(patch as object),
        ...(resetPage && !("page" in patch) ? { page: null } : {}),
      } as never);
    },
    [setState],
  );

  const setFilter = useCallback(
    (key: string, value: string | string[] | null) => {
      const empty = value === null || (Array.isArray(value) ? value.length === 0 : value === "");
      set({ [key]: empty ? null : value });
    },
    [set],
  );

  const clearFilters = useCallback(() => {
    const patch: Record<string, null> = { q: null };
    for (const f of filters) patch[f.key] = null;
    set(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, filterKey]);

  const hasActiveFilters = params.q !== "" || Object.keys(params.filters).length > 0;

  return { params, set, setFilter, clearFilters, hasActiveFilters };
}

export function parseSort(sort: string): { id: string; desc: boolean } | null {
  if (!sort) return null;
  const [id, dir] = sort.split(":");
  if (!id) return null;
  return { id, desc: dir === "desc" };
}
