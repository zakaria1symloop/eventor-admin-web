"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronDown, Eye, Layers, Trash2, Users } from "lucide-react";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { toneClasses, type Tone } from "@/components/ui/badge";
import { Checkbox, Field, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { toast } from "@/components/feedback/toast";

/* ------------------------------------------------------------------ QuickFilterCards */

export type QuickFilter = Record<string, string | string[] | null>;

export interface QuickFilterItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** URL patch applied on click (null clears a key). */
  filter: QuickFilter;
}

export function QuickFilterCards({
  items,
  isActive,
  onSelect,
  className,
}: {
  items: QuickFilterItem[];
  isActive?: (item: QuickFilterItem) => boolean;
  onSelect: (item: QuickFilterItem) => void;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((it) => {
        const active = isActive?.(it) ?? false;
        const tone = toneClasses[it.tone ?? "brand"];
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(it)}
            className={cn(
              "rounded-xl border bg-surface px-4 py-3.5 text-start transition-colors hover:border-brand/30",
              active ? "border-brand ring-1 ring-brand" : "border-border",
            )}
          >
            <span className="flex items-center gap-2 text-13 text-ink-2">
              <span aria-hidden className={cn("size-2 rounded-full", tone.dot)} />
              {it.label}
            </span>
            <span className="mt-1 block text-26 font-semibold text-ink tabular-nums">{it.value}</span>
            {it.hint && <span className="block text-12 text-muted">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * True when every key of the item's filter matches the current values.
 * A card that only clears filters (all values null) is never shown as selected (Figma: none selected).
 */
export function quickFilterMatches(
  filter: QuickFilter,
  current: Record<string, string | string[] | undefined>,
) {
  const entries = Object.entries(filter);
  if (entries.length === 0 || entries.every(([, v]) => v === null)) return false;
  return entries.every(([k, v]) => {
    const cur = current[k];
    if (v === null) return cur === undefined || cur === "";
    const a = Array.isArray(v) ? [...v].sort() : [v];
    const b = Array.isArray(cur) ? [...cur].sort() : cur === undefined ? [] : [cur];
    return a.length === b.length && a.every((x, i) => x === b[i]);
  });
}

/* ------------------------------------------------------------------ ColumnsMenu (persisted per resource) */

const columnListeners = new Set<() => void>();
const storageKeyFor = (resource: string) => `eventor.columns.${resource}`;

function readHidden(resource: string): string {
  try {
    return window.localStorage.getItem(storageKeyFor(resource)) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Hidden column ids for a resource, stored in localStorage. */
export function useColumnVisibility(resource: string) {
  const raw = useSyncExternalStore(
    (cb) => {
      columnListeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        columnListeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => readHidden(resource),
    () => "[]",
  );
  const hidden = useMemo<string[]>(() => {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, [raw]);
  const setHidden = useCallback(
    (next: string[]) => {
      try {
        window.localStorage.setItem(storageKeyFor(resource), JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      columnListeners.forEach((l) => l());
    },
    [resource],
  );
  return [hidden, setHidden] as const;
}

export function ColumnsMenu({
  columns,
  hidden,
  onChange,
}: {
  columns: { id: string; label: ReactNode; hideable?: boolean }[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const t = useTranslations("dataList");
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button
          variant="secondary"
          size="sm"
          icon={<Layers />}
          className="h-9 w-9 px-0"
          aria-label={t("columns")}
          title={t("columns")}
        />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[220px] rounded-lg border border-border bg-surface p-1.5 shadow-overlay"
        >
          <Dropdown.Label className="px-2 py-1 text-11 font-medium text-muted uppercase">
            {t("showColumns")}
          </Dropdown.Label>
          {columns.map((c) => (
            <Dropdown.CheckboxItem
              key={c.id}
              checked={!hidden.includes(c.id)}
              disabled={c.hideable === false}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) => onChange(on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
              className="flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-13 text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-canvas"
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-xs border",
                  !hidden.includes(c.id) ? "border-brand bg-brand text-white" : "border-[#CFCBD8]",
                )}
              >
                <Dropdown.ItemIndicator>
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                    <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </Dropdown.ItemIndicator>
              </span>
              {c.label}
            </Dropdown.CheckboxItem>
          ))}
          {hidden.length > 0 && (
            <>
              <Dropdown.Separator className="-mx-1.5 my-1 h-px bg-border" />
              <Dropdown.Item
                onSelect={() => onChange([])}
                className="flex h-8 cursor-pointer items-center rounded-sm px-2 text-13 font-medium text-brand outline-none data-[highlighted]:bg-canvas"
              >
                {t("resetColumns")}
              </Dropdown.Item>
            </>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* ------------------------------------------------------------------ SavedViewsMenu */

export interface SavedView {
  id: string;
  name: string;
  /** URL state: q, sort, tab, filters */
  query: Record<string, string | string[]>;
  isShared: boolean;
  /** false → shared by another admin */
  isMine: boolean;
  ownerName?: string;
}

export interface SavedViewsSource {
  queryKey: readonly unknown[];
  queryFn: () => Promise<SavedView[]>;
  onSave: (input: {
    name: string;
    isShared: boolean;
    query: Record<string, string | string[]>;
  }) => Promise<unknown>;
  onDelete?: (view: SavedView) => Promise<unknown>;
}

export function SavedViewsMenu({
  source,
  views: staticViews,
  activeViewId,
  onApply,
  onSaveCurrent,
}: {
  source?: Pick<SavedViewsSource, "queryKey" | "queryFn" | "onDelete">;
  views?: SavedView[];
  activeViewId?: string | null;
  onApply: (view: SavedView) => void;
  onSaveCurrent: () => void;
}) {
  const t = useTranslations("views");
  const query = useQuery({
    queryKey: [...(source?.queryKey ?? ["saved-views"]), "views"],
    queryFn: () => source!.queryFn(),
    enabled: !!source && !staticViews,
  });
  const views = staticViews ?? query.data ?? [];
  const mine = views.filter((v) => v.isMine);
  const shared = views.filter((v) => !v.isMine);
  const active = views.find((v) => v.id === activeViewId);

  const group = (title: string, list: SavedView[]) => (
    <Dropdown.Group>
      <Dropdown.Label className="px-2 pt-1.5 pb-1 text-11 font-medium text-muted uppercase">
        {title}
      </Dropdown.Label>
      {list.length === 0 && <div className="px-2 pb-2 text-12 text-faint">{t("none")}</div>}
      {list.map((v) => (
        <Dropdown.Item
          key={v.id}
          onSelect={() => onApply(v)}
          className="group flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-13 text-ink outline-none data-[highlighted]:bg-canvas"
        >
          {v.isShared ? (
            <Users className="size-4 text-ink-2" aria-hidden />
          ) : (
            <Bookmark className="size-4 text-ink-2" aria-hidden />
          )}
          <span className={cn("flex-1 truncate", v.id === activeViewId && "font-medium text-brand")}>
            {v.name}
          </span>
          {!v.isMine && v.ownerName && <span className="text-11 text-faint">{v.ownerName}</span>}
          {v.isMine && source?.onDelete && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={t("delete", { name: v.name })}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                source.onDelete!(v).then(
                  () => void query.refetch(),
                  (err) => toast.apiError(err),
                );
              }}
              className="hidden size-6 items-center justify-center rounded-sm text-muted group-data-[highlighted]:flex hover:text-red"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </span>
          )}
        </Dropdown.Item>
      ))}
    </Dropdown.Group>
  );

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button
          variant="secondary"
          size="sm"
          icon={<Eye />}
          iconEnd={<ChevronDown className="opacity-70" />}
          className="h-9"
          aria-label={active ? `${t("views")}: ${active.name}` : t("views")}
          title={t("views")}
        >
          {active && <span className="max-w-[140px] truncate">{active.name}</span>}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[260px] rounded-lg border border-border bg-surface p-1.5 shadow-overlay"
        >
          {group(t("myViews"), mine)}
          <Dropdown.Separator className="-mx-1.5 my-1 h-px bg-border" />
          {group(t("sharedViews"), shared)}
          <Dropdown.Separator className="-mx-1.5 my-1 h-px bg-border" />
          <Dropdown.Item
            onSelect={onSaveCurrent}
            className="flex h-8 cursor-pointer items-center rounded-sm px-2 text-13 font-medium text-brand outline-none data-[highlighted]:bg-canvas"
          >
            {t("saveCurrent")}
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; isShared: boolean }) => Promise<unknown>;
}) {
  const t = useTranslations("views");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [isShared, setShared] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName("");
      setShared(false);
      setError(null);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(tc("required"));
    setPending(true);
    try {
      await onSave({ name: name.trim(), isShared });
      toast.success(t("saved", { name: name.trim() }));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("saveTitle")}
        description={t("saveDescription")}
        icon={<Bookmark />}
        width={440}
        footer={
          <>
            <span className="me-auto" />
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form="save-view-form" loading={pending}>
              {t("save")}
            </Button>
          </>
        }
      >
        <form id="save-view-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("name")} required error={error}>
            <TextInput value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Checkbox
            label={t("share")}
            description={t("shareHint")}
            checked={isShared}
            onCheckedChange={setShared}
          />
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
