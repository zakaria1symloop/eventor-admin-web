"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
  Clock,
  CornerDownLeft,
  FileText,
  GraduationCap,
  Loader2,
  Search,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  overviewKeys,
  search,
  SEARCH_SCOPES,
  type SearchGroupType,
  type SearchItem,
  type SearchResult,
  type SearchScope,
} from "@/lib/api/overview";
import { dashboardHref } from "@/lib/api/reviews";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";

const RECENT_KEY = "eventor.admin.recentSearches";
const RECENT_MAX = 6;

export function loadRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(q: string): string[] {
  const term = q.trim();
  if (!term) return loadRecentSearches();
  const next = [term, ...loadRecentSearches().filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(
    0,
    RECENT_MAX,
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage full / disabled: recent searches are a convenience only
  }
  return next;
}

const groupIcon: Record<Exclude<SearchGroupType, "users">, ReactNode> = {
  services: <Briefcase />,
  bookings: <CalendarDays />,
  requests: <GraduationCap />,
  disputes: <TriangleAlert />,
  pages: <FileText />,
};

interface FlatItem {
  key: string;
  group: SearchGroupType;
  item: SearchItem;
}

/** SHL-01 — global search: debounced, scopes, grouped results, keyboard navigation, exact match on Enter. */
export function CommandPalette({
  open,
  onOpenChange,
  debounceMs = 250,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debounceMs?: number;
}) {
  const t = useTranslations("commandPalette");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [active, setActive] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => (open ? loadRecentSearches() : []));
  const [jumping, setJumping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset when the palette opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setInput("");
      setDebounced("");
      setScope("all");
      setActive(0);
      setNavigated(false);
      setJumping(false);
      setRecent(loadRecentSearches());
    }
  }

  useEffect(() => {
    const q = input.trim();
    const timer = setTimeout(() => setDebounced(q), q ? debounceMs : 0);
    return () => clearTimeout(timer);
  }, [input, debounceMs]);

  const limit = scope === "all" ? 5 : 10;
  const results = useQuery({
    queryKey: overviewKeys.search(debounced, scope),
    queryFn: ({ signal }) => search(debounced, scope, limit, signal),
    enabled: open && debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
  const data = debounced ? results.data : undefined;

  const flat: FlatItem[] = useMemo(
    () =>
      (data?.groups ?? []).flatMap((g) =>
        g.items.map((item) => ({ key: `${g.type}:${item.id}`, group: g.type, item })),
      ),
    [data],
  );
  const showRecent = !input.trim();
  const activeIndex = Math.min(active, Math.max((showRecent ? recent.length : flat.length) - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  function go(href: string, term: string) {
    setRecent(saveRecentSearch(term));
    onOpenChange(false);
    router.push(dashboardHref(href) ?? href);
  }

  function changeInput(value: string) {
    setInput(value);
    setActive(0);
    setNavigated(false);
  }

  async function onEnter() {
    const q = input.trim();
    if (!q) {
      const term = recent[activeIndex];
      if (term) changeInput(term);
      return;
    }
    let result: SearchResult | undefined = debounced === q && !results.isPlaceholderData ? data : undefined;
    if (!result) {
      setJumping(true);
      try {
        result = await queryClient.fetchQuery({
          queryKey: overviewKeys.search(q, scope),
          queryFn: ({ signal }) => search(q, scope, limit, signal),
          staleTime: 15_000,
        });
      } catch {
        setJumping(false);
        return;
      }
      setJumping(false);
      setDebounced(q);
    }
    if (!result) return;
    if (result.exactMatch && !navigated) {
      go(result.exactMatch.href, q);
      return;
    }
    const items = result.groups.flatMap((g) => g.items);
    const target = items[navigated ? activeIndex : 0];
    if (target) go(target.href, q);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const count = input.trim() ? flat.length : recent.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!count) return;
      setNavigated(true);
      setActive((i) => {
        const cur = Math.min(i, count - 1);
        return e.key === "ArrowDown" ? (cur + 1) % count : (cur - 1 + count) % count;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      void onEnter();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const i = SEARCH_SCOPES.indexOf(scope);
      const n = SEARCH_SCOPES.length;
      setScope(SEARCH_SCOPES[(i + (e.shiftKey ? n - 1 : 1)) % n]);
      setActive(0);
      setNavigated(false);
    }
  }

  const loading = !!input.trim() && (input.trim() !== debounced || results.isFetching) && !data;
  const optionId = (i: number) => `command-palette-option-${i}`;
  const itemTitle = (f: FlatItem) =>
    f.group === "pages" && locale === "ar" ? f.item.subtitle || f.item.title : f.item.title;
  const itemSub = (f: FlatItem) => (f.group === "pages" ? null : f.item.subtitle);

  let index = -1;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#1A0D33]/35" />
        <RadixDialog.Content className="fixed start-1/2 top-[8vh] z-50 flex max-h-[80dvh] w-[calc(100vw-32px)] max-w-[640px] flex-col overflow-hidden rounded-2xl bg-surface shadow-overlay ltr:-translate-x-1/2 rtl:translate-x-1/2">
          <RadixDialog.Title className="sr-only">{t("title")}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{t("hint")}</RadixDialog.Description>
          <div className="flex items-center gap-3 border-b border-border px-4">
            {jumping || (results.isFetching && !!debounced) ? (
              <Loader2 aria-hidden className="size-[18px] animate-spin text-muted" />
            ) : (
              <Search aria-hidden className="size-[18px] text-ink" />
            )}
            <input
              autoFocus
              role="combobox"
              aria-expanded={flat.length > 0 || (showRecent && recent.length > 0)}
              aria-controls="command-palette-results"
              aria-activedescendant={
                (showRecent ? recent.length : flat.length) > 0 ? optionId(activeIndex) : undefined
              }
              aria-autocomplete="list"
              aria-label={t("placeholder")}
              value={input}
              onChange={(e) => changeInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("placeholder")}
              className="h-14 flex-1 bg-transparent text-15 text-ink outline-none placeholder:text-faint"
            />
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label={t("close")}
                className="rounded-sm border border-border px-1.5 py-0.5 font-sans text-11 text-muted hover:bg-canvas"
              >
                Esc
              </button>
            </RadixDialog.Close>
          </div>
          <div role="group" aria-label={t("scopes")} className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
            {SEARCH_SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => {
                  setScope(s);
                  setActive(0);
                  setNavigated(false);
                }}
                className={cn(
                  "h-7 rounded-pill border px-3 text-12 font-medium transition-colors",
                  scope === s
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-border text-ink-2 hover:bg-canvas",
                )}
              >
                {t(`scope.${s}`)}
              </button>
            ))}
          </div>

          <div
            ref={listRef}
            id="command-palette-results"
            role="listbox"
            aria-label={t("results")}
            className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2"
          >
            {showRecent ? (
              recent.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-2 pt-2 pb-1.5">
                    <span className="text-11 font-medium tracking-[0.08em] text-muted uppercase">
                      {t("recent")}
                    </span>
                    <button
                      type="button"
                      className="text-11 text-muted hover:text-ink"
                      onClick={() => {
                        try {
                          window.localStorage.removeItem(RECENT_KEY);
                        } catch {
                          // ignore
                        }
                        setRecent([]);
                      }}
                    >
                      {t("clearRecent")}
                    </button>
                  </div>
                  {recent.map((term, i) => (
                    <div
                      key={term}
                      id={optionId(i)}
                      data-index={i}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => changeInput(term)}
                      className={cn(
                        "flex h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-14 text-ink",
                        i === activeIndex && "bg-brand-soft/60",
                      )}
                    >
                      <Clock aria-hidden className="size-4 text-muted" />
                      {term}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-14 text-ink-2">{t("empty")}</p>
                  <p className="mt-1 text-12 text-faint">{t("hint")}</p>
                </div>
              )
            ) : results.isError && !data ? (
              <div className="px-4 py-10 text-center">
                <p className="text-14 text-ink-2">{t("error")}</p>
                <button
                  type="button"
                  onClick={() => void results.refetch()}
                  className="mt-2 text-13 font-medium text-brand hover:underline"
                >
                  {t("retry")}
                </button>
              </div>
            ) : loading ? (
              <div className="flex flex-col gap-2 px-2 py-3" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="size-8 animate-pulse rounded-full bg-gray-soft" />
                    <span className="h-3 flex-1 animate-pulse rounded-sm bg-gray-soft" />
                  </div>
                ))}
              </div>
            ) : data && flat.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-gray-soft text-muted [&_svg]:size-5">
                  <SearchX />
                </span>
                <p className="text-14 font-medium text-ink">{t("noResults", { q: debounced })}</p>
                <p className="mt-1 text-12 text-muted">{t("noResultsHint")}</p>
              </div>
            ) : (
              data?.groups
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.type} role="group" aria-label={t(`groups.${g.type}`)}>
                    <div className="px-2 pt-3 pb-1.5 text-11 font-medium tracking-[0.08em] text-muted uppercase">
                      {t(`groups.${g.type}`)}
                    </div>
                    {g.items.map((item) => {
                      index += 1;
                      const i = index;
                      const f = flat[i];
                      const isActive = i === activeIndex;
                      const exact = data.exactMatch?.href === item.href;
                      return (
                        <div
                          key={f.key}
                          id={optionId(i)}
                          data-index={i}
                          role="option"
                          aria-selected={isActive}
                          onMouseMove={() => {
                            if (i !== activeIndex) {
                              setActive(i);
                              setNavigated(true);
                            }
                          }}
                          onClick={() => go(item.href, input)}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
                            isActive && "bg-brand-soft/60",
                          )}
                        >
                          {g.type === "users" ? (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-11 font-semibold text-brand">
                              {initials(item.title)}
                            </span>
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-ink-2 [&_svg]:size-4">
                              {groupIcon[g.type]}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 leading-tight">
                            <span
                              className={cn(
                                "block truncate text-14 font-medium",
                                isActive ? "text-brand" : "text-ink",
                              )}
                            >
                              {itemTitle(f)}
                            </span>
                            {itemSub(f) && (
                              <span className="block truncate text-12 text-muted">{itemSub(f)}</span>
                            )}
                          </span>
                          {exact && (
                            <span className="rounded-pill bg-green-soft px-2 py-0.5 text-11 font-medium text-green">
                              {t("exact")}
                            </span>
                          )}
                          {item.badge && (
                            <span className="hidden rounded-pill bg-gray-soft px-2 py-0.5 text-11 text-ink-2 capitalize sm:inline">
                              {item.badge.replace(/_/g, " ")}
                            </span>
                          )}
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-11 text-muted">
                              <CornerDownLeft aria-hidden className="size-3" />
                              {t("open")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-11 text-muted">
            <span>↑↓ {t("keys.move")}</span>
            <span>↵ {t("keys.open")}</span>
            <span>Tab {t("keys.scope")}</span>
            <span>Esc {t("keys.close")}</span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Ctrl/⌘ K toggles the palette. */
export function useCommandPaletteShortcut(setOpen: (fn: (open: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

export function GlobalSearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const t = useTranslations("topbar");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts="Control+K"
      className={cn(
        "flex h-10 w-full max-w-[460px] items-center gap-2.5 rounded-lg bg-canvas px-3 text-start text-14 text-faint transition-colors hover:bg-gray-soft",
        className,
      )}
    >
      <Search aria-hidden className="size-[18px] shrink-0 text-muted" />
      <span className="flex-1 truncate">{t("searchPlaceholder")}</span>
      <kbd className="hidden rounded-sm border border-border bg-surface px-1.5 py-0.5 font-sans text-11 text-muted sm:inline">
        {t("searchShortcut")}
      </kbd>
    </button>
  );
}
