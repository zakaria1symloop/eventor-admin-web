"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  Check,
  FileText,
  FolderTree,
  KeyRound,
  LogIn,
  MapPin,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  ShieldAlert,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import {
  DataList,
  StackCell,
  type AdvancedFilterField,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import { EmptyState } from "@/components/feedback/states";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { listAdmins, adminKeys } from "@/lib/api/auth";
import {
  activityLogKeys,
  actorHref,
  listActivityLog,
  objectHref,
  type ActivityLogItem,
  type ActivityLogQuery,
  type AuditLevel,
  type AuditSource,
} from "@/lib/api/activity-log";
import { savedViewsSource } from "@/lib/api/saved-views";
import { cn } from "@/lib/utils/cn";
import { formatNumber, intlLocale } from "@/lib/utils/format";
import { useActionLabel } from "./action-label";
import { LogEntryDrawer } from "./log-entry-drawer";

const LEVELS: AuditLevel[] = ["info", "normal", "sensitive", "security"];
const SOURCES: AuditSource[] = ["dashboard", "android", "ios", "web", "system"];
export const KNOWN_ACTIONS = [
  "settings.updated",
  "category.created",
  "category.updated",
  "category.deleted",
  "category.reordered",
  "wilaya.updated",
  "commune.created",
  "commune.updated",
  "commune.deleted",
  "communes.imported",
  "admin.invited",
  "admin.removed",
  "auth.login",
  "auth.logout",
  "auth.account_locked",
  "auth.password_reset",
  "export.requested",
] as const;
const OBJECT_TYPES = ["settings", "category", "wilaya", "commune", "user", "admin", "export", "saved_view"];

/** Date preset / custom range → ISO bounds. */
function dateBounds(filters: ListParams["filters"], now = new Date()): { from?: string; to?: string } {
  const custom = parseRange(filters.created);
  if (custom.from || custom.to) {
    return {
      from: custom.from ? new Date(`${custom.from}T00:00:00`).toISOString() : undefined,
      to: custom.to ? new Date(`${custom.to}T23:59:59.999`).toISOString() : undefined,
    };
  }
  const preset = typeof filters.date === "string" ? filters.date : "";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === "today") return { from: start.toISOString() };
  if (preset === "7d") return { from: new Date(start.getTime() - 6 * 86400000).toISOString() };
  if (preset === "30d") return { from: new Date(start.getTime() - 29 * 86400000).toISOString() };
  return {};
}

const arr = (v: string | string[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

/** List params → API query (tab, date presets and custom range translated). Shared with the export. */
export function toActivityQuery(params: ListParams): ActivityLogQuery {
  const f = params.filters;
  let level = arr(f.level) as AuditLevel[] | undefined;
  let source = arr(f.source) as AuditSource[] | undefined;
  if (params.tab === "admin") source = ["dashboard"];
  if (params.tab === "security") level = ["security"];
  return {
    q: params.q || undefined,
    actorId: typeof f.actorId === "string" ? f.actorId : undefined,
    action: arr(f.action),
    objectType: typeof f.objectType === "string" ? f.objectType : undefined,
    level,
    source,
    ...dateBounds(f),
    sort: params.sort || undefined,
    page: params.page,
    limit: params.limit,
  };
}

/** Total entries matching quick-filter values (limit=1 → meta.total). */
function useLogCount(key: string, filters: ListParams["filters"]) {
  return useQuery({
    queryKey: [...activityLogKeys.stats(), key],
    queryFn: () =>
      listActivityLog(toActivityQuery({ q: "", page: 1, limit: 1, sort: "", tab: "all", filters })).then(
        (r) => r.meta.total,
      ),
    staleTime: 60_000,
  });
}

function actionIcon(action: string): { icon: LucideIcon; tone: string } {
  const [obj, verb = ""] = action.split(".");
  if (obj === "auth" && /locked|reuse|failed/.test(verb))
    return { icon: ShieldAlert, tone: "bg-amber-soft text-amber" };
  if (obj === "auth") return { icon: LogIn, tone: "bg-blue-soft text-blue" };
  if (/deleted|removed|revoked/.test(verb)) return { icon: Trash2, tone: "bg-red-soft text-red" };
  if (/blocked/.test(verb)) return { icon: Ban, tone: "bg-red-soft text-red" };
  if (/approved|accepted/.test(verb)) return { icon: Check, tone: "bg-green-soft text-green" };
  if (obj === "settings") return { icon: SettingsIcon, tone: "bg-red-soft text-red" };
  if (obj === "category") return { icon: FolderTree, tone: "bg-brand-soft text-brand" };
  if (obj === "wilaya" || obj?.startsWith("commune"))
    return { icon: MapPin, tone: "bg-brand-soft text-brand" };
  if (obj === "export") return { icon: FileText, tone: "bg-gray-soft text-ink-2" };
  if (/invited/.test(verb)) return { icon: UserPlus, tone: "bg-brand-soft text-brand" };
  if (obj === "account") return { icon: KeyRound, tone: "bg-gray-soft text-ink-2" };
  if (/created|imported/.test(verb)) return { icon: Plus, tone: "bg-brand-soft text-brand" };
  return { icon: Pencil, tone: "bg-brand-soft text-brand" };
}

export function ActivityLogScreen() {
  const t = useTranslations("activityLog");
  const tp = useTranslations("pages.activityLog");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const actionLabel = useActionLabel();
  const [entry, setEntry] = useQueryState("entry", parseAsString.withOptions({ history: "push" }));
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);

  const admins = useQuery({ queryKey: adminKeys.list(), queryFn: listAdmins, staleTime: 60_000 });

  const objectTypeLabel = useCallback(
    (type: string) => (t.has(`objectTypes.${type}`) ? t(`objectTypes.${type}`) : type.replace(/_/g, " ")),
    [t],
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        key: "actorId",
        label: t("filters.actor"),
        options: (admins.data?.data ?? [])
          .filter((a) => a.status === "active")
          .map((a) => ({ value: a.id, label: a.fullName })),
      },
      {
        key: "action",
        label: t("filters.action"),
        multiple: true,
        options: KNOWN_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) })),
      },
      {
        key: "objectType",
        label: t("filters.objectType"),
        options: OBJECT_TYPES.map((o) => ({ value: o, label: objectTypeLabel(o) })),
      },
      {
        key: "date",
        label: t("filters.date"),
        options: ["today", "7d", "30d"].map((d) => ({ value: d, label: t(`dates.${d}`) })),
      },
    ],
    [t, admins.data, actionLabel, objectTypeLabel],
  );

  const advancedFilters = useMemo<AdvancedFilterField[]>(
    () => [
      {
        key: "level",
        label: t("filters.level"),
        type: "multiselect",
        display: "chips",
        options: LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) })),
      },
      {
        key: "source",
        label: t("filters.source"),
        type: "multiselect",
        display: "chips",
        options: SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) })),
      },
      { key: "created", label: t("filters.dateRange"), type: "daterange" },
    ],
    [t],
  );

  const stat = useLogCount;
  const adminToday = stat("adminToday", { date: "today", source: ["dashboard"] });
  const appToday = stat("appToday", { date: "today", source: ["android", "ios", "web"] });
  const sensitiveWeek = stat("sensitiveWeek", { date: "7d", level: ["sensitive"] });
  const securityToday = stat("securityToday", { date: "today", level: ["security"] });
  const num = (q: { data?: number }) => (q.data === undefined ? "—" : formatNumber(q.data, locale));

  const quickFilters: QuickFilterItem[] = [
    {
      key: "adminToday",
      label: t("stats.adminToday"),
      value: num(adminToday),
      hint: t("stats.adminTodayHint"),
      tone: "brand",
      filter: { date: "today", source: ["dashboard"], level: null },
    },
    {
      key: "appToday",
      label: t("stats.appToday"),
      value: num(appToday),
      hint: t("stats.appTodayHint"),
      tone: "gray",
      filter: { date: "today", source: ["android", "ios", "web"], level: null },
    },
    {
      key: "sensitiveWeek",
      label: t("stats.sensitiveWeek"),
      value: num(sensitiveWeek),
      hint: t("stats.sensitiveWeekHint"),
      tone: "red",
      filter: { date: "7d", level: ["sensitive"], source: null },
    },
    {
      key: "securityToday",
      label: t("stats.securityToday"),
      value: num(securityToday),
      hint: t("stats.securityTodayHint"),
      tone: "amber",
      filter: { date: "today", level: ["security"], source: null },
    },
  ];

  const time = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  const day = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "short", year: "numeric" }),
    [locale],
  );

  const columns = useMemo<DataColumn<ActivityLogItem>[]>(
    () => [
      {
        id: "action",
        header: t("columns.action"),
        hideable: false,
        cell: (r) => {
          const { icon: Icon, tone } = actionIcon(r.action);
          return (
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-14 font-medium text-ink">{actionLabel(r.action)}</span>
                <span className="block truncate text-12 text-muted" dir="ltr">
                  {r.action}
                </span>
              </span>
            </div>
          );
        },
      },
      {
        id: "actor",
        header: t("columns.by"),
        cell: (r) => {
          if (!r.actor) return <span className="text-13 text-muted">{t("system")}</span>;
          const href = actorHref(r.actor);
          const role = t.has(`roles.${r.actor.role}`) ? t(`roles.${r.actor.role}`) : r.actor.role;
          return (
            <span className="block min-w-0 leading-tight">
              {href ? (
                <Link href={href} className="block truncate text-13 font-medium text-brand hover:underline">
                  {r.actor.fullName}
                </Link>
              ) : (
                <span className="block truncate text-13 text-ink">{r.actor.fullName}</span>
              )}
              <span className="block truncate text-12 text-muted">{role}</span>
            </span>
          );
        },
      },
      {
        id: "object",
        header: t("columns.on"),
        cell: (r) => {
          const href = objectHref(r.objectType, r.objectId);
          const label = r.objectLabel ?? r.objectId ?? "—";
          return (
            <span className="block min-w-0 leading-tight">
              {href ? (
                <Link href={href} className="block truncate text-13 font-medium text-brand hover:underline">
                  {label}
                </Link>
              ) : (
                <span className="block truncate text-13 text-ink">{label}</span>
              )}
              <span className="block truncate text-12 text-muted">{objectTypeLabel(r.objectType)}</span>
            </span>
          );
        },
      },
      {
        id: "source",
        header: t("columns.source"),
        cell: (r) => (
          <StackCell
            primary={t(`sources.${r.source}`)}
            secondary={r.ip ? <span dir="ltr">{r.ip}</span> : undefined}
          />
        ),
      },
      {
        id: "createdAt",
        header: t("columns.when"),
        sortable: true,
        cell: (r) => (
          <time dateTime={r.createdAt} className="block leading-tight">
            <span className="block text-13 text-ink">{day.format(new Date(r.createdAt))}</span>
            <span className="block text-12 text-muted">{time.format(new Date(r.createdAt))}</span>
          </time>
        ),
      },
      {
        id: "level",
        header: t("columns.level"),
        cell: (r) => <StatusBadge domain="auditLevel" status={r.level} label={t(`levels.${r.level}`)} />,
      },
    ],
    [t, actionLabel, objectTypeLabel, day, time],
  );

  const exportFilters = useMemo(() => {
    if (!params) return {};
    const { page: _p, limit: _l, sort: _s, ...rest } = toActivityQuery(params);
    void _p;
    void _l;
    void _s;
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  }, [params]);

  const exportColumns = [
    "createdAt",
    "actor",
    "actorEmail",
    "actorRole",
    "action",
    "objectType",
    "objectId",
    "objectLabel",
    "level",
    "source",
    "ip",
    "requestId",
    "changes",
    "note",
  ].map((key) => ({
    key,
    label: t(`exportColumns.${key}`),
    defaultChecked: [
      "createdAt",
      "actor",
      "action",
      "objectType",
      "objectLabel",
      "level",
      "source",
      "ip",
    ].includes(key),
  }));

  const [total, setTotal] = useState<number | null>(null);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("setup") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        actions={
          <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
            {t("export")}
          </Button>
        }
      />
      <DataList<ActivityLogItem>
        resource={activityLogKeys.all}
        queryFn={async (p) => {
          const res = await listActivityLog(toActivityQuery(p));
          setTotal(res.meta.total);
          return res;
        }}
        columns={columns}
        getRowId={(r) => r.id}
        tabs={[
          { key: "all", label: t("tabs.all") },
          { key: "admin", label: t("tabs.admin") },
          { key: "security", label: t("tabs.security") },
        ]}
        defaultTab="all"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "createdAt:desc", label: t("sort.newest") },
          { value: "createdAt:asc", label: t("sort.oldest") },
        ]}
        defaultSort="createdAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("activity-log")}
        columnsStorageKey="activity-log"
        itemLabel={t("itemLabel")}
        onRowClick={(r) => void setEntry(r.id)}
        onParamsChange={setParams}
        rowMenu={(r) => [
          [{ icon: <FileText />, label: t("openEntry"), onSelect: () => void setEntry(r.id) }],
        ]}
        emptyState={
          <EmptyState icon={<FileText />} title={t("emptyTitle")} description={t("emptyDescription")} />
        }
      />
      <LogEntryDrawer id={entry} onClose={() => void setEntry(null)} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="activity-log"
        title={t("exportTitle")}
        filters={exportFilters}
        summary={t("exportSummary", { count: total ?? 0 })}
        summaryHint={Object.keys(exportFilters).length > 0 ? t("exportFiltered") : t("exportAll")}
        columns={exportColumns}
      />
    </>
  );
}
