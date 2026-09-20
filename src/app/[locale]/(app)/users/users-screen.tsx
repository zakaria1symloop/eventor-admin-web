"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  Eye,
  FileText,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Settings,
  Star,
  Trash2,
  TriangleAlert,
  Unlock,
  Users,
} from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  DataList,
  DateCell,
  StackCell,
  StatusBadgeCell,
  UserCell,
  formatRange,
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
import { Link } from "@/i18n/navigation";
import { savedViewsSource } from "@/lib/api/saved-views";
import {
  listUsers,
  userKeys,
  usersQuery,
  type BulkAction,
  type UserList,
  type UserRow,
} from "@/lib/api/users";
import { formatNumber } from "@/lib/utils/format";
import {
  BlockUserDialog,
  BulkUsersDialog,
  DeleteUserDialog,
  ResetPasswordDialog,
  SignOutEverywhereDialog,
  toastBlocked,
  type UserTarget,
} from "./user-dialogs";
import { AddUserDialog, EditUserDrawer } from "./user-form-dialogs";
import { localName, useUserOptions } from "./use-user-options";
import { useUser } from "./use-user";

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Figma label for a document verification status. */
export function verificationDomainStatus(status: string) {
  return status === "pending" ? "in_review" : status;
}

export function userHref(u: { id: string }) {
  return `/users/${u.id}`;
}

export function UsersScreen() {
  const t = useTranslations("users");
  const tp = useTranslations("pages.users");
  const tb = useTranslations("breadcrumb");
  const tr = useTranslations("status.role");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { categoryOptions, wilayaOptions } = useUserOptions();

  const [dialog, setDialog] = useQueryStates(
    { new: parseAsString, edit: parseAsString },
    { history: "replace" },
  );
  const [blocking, setBlocking] = useState<UserTarget | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserTarget | null>(null);
  const [signingOut, setSigningOut] = useState<UserTarget | null>(null);
  const [bulk, setBulk] = useState<{ action: BulkAction; rows: UserRow[]; clear: () => void } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);

  const editing = useUser(dialog.edit);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: userKeys.all });

  // Quick stats: tab counters of the unfiltered list + accounts created in the last 7 days.
  const [now] = useState(() => Date.now());
  const weekAgo = isoDay(new Date(now - 7 * DAY));
  const stats = useQuery({
    queryKey: [...userKeys.all, "stats"],
    queryFn: () => listUsers({ limit: 1 }),
  });
  const newThisWeek = useQuery({
    queryKey: [...userKeys.all, "stats", "new", weekAgo],
    queryFn: () => listUsers({ limit: 1, joinedFrom: weekAgo }),
  });
  const counts = stats.data?.meta.counts;
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));
  const active = counts ? counts.all - counts.blocked : undefined;
  const quickFilters: QuickFilterItem[] = [
    {
      key: "active",
      label: t("stats.active"),
      value: v(active),
      hint:
        counts && counts.all > 0
          ? t("stats.activeHint", { percent: ((100 * (active ?? 0)) / counts.all).toFixed(1) })
          : undefined,
      tone: "green",
      filter: { status: "active" },
    },
    {
      key: "new",
      label: t("stats.new"),
      value: v(newThisWeek.data?.meta.total),
      hint: t("stats.newHint"),
      tone: "brand",
      filter: { joined: formatRange(weekAgo, "") },
    },
    {
      key: "awaiting",
      label: t("stats.awaiting"),
      value: v(counts?.awaiting_verification),
      hint: t("stats.awaitingHint"),
      tone: "amber",
      filter: { role: "provider", verificationStatus: "pending" },
    },
    {
      key: "blocked",
      label: t("stats.blocked"),
      value: v(counts?.blocked),
      hint: t("stats.blockedHint"),
      tone: "red",
      filter: { status: "blocked" },
    },
  ];

  const statusOptions = [
    { value: "active", label: t("statuses.active") },
    { value: "blocked", label: t("statuses.blocked") },
  ];
  const verificationOptions = ["verified", "pending", "rejected", "not_required"].map((s) => ({
    value: s,
    label: t(`verification.${s}`),
  }));
  const today = isoDay(new Date(now));
  const filters: FilterConfig[] = [
    { key: "status", label: t("filters.status"), options: statusOptions },
    { key: "verificationStatus", label: t("filters.verification"), options: verificationOptions },
    { key: "wilaya", label: t("filters.wilaya"), options: wilayaOptions, multiple: true },
    {
      key: "joined",
      label: t("filters.joined"),
      options: [7, 30, 90, 365].map((d) => ({
        value: formatRange(isoDay(new Date(now - d * DAY)), ""),
        label: t("filters.joinedLast", { count: d }),
      })),
      format: (val) => {
        const [from = "", to = ""] = String(val).split("..");
        if (from && to) return `${from} → ${to}`;
        return from ? t("filters.since", { date: from }) : t("filters.until", { date: to || today });
      },
    },
  ];

  const advancedFilters: AdvancedFilterField[] = [
    {
      key: "role",
      label: t("filters.role"),
      type: "segmented",
      options: [
        { value: "client", label: tr("client") },
        { value: "provider", label: tr("provider") },
      ],
    },
    { key: "status", label: t("filters.accountStatus"), type: "segmented", options: statusOptions },
    {
      key: "verificationStatus",
      label: t("filters.verification"),
      type: "select",
      options: verificationOptions,
    },
    {
      key: "wilaya",
      label: t("filters.wilaya"),
      type: "multiselect",
      display: "dropdown",
      options: wilayaOptions,
      hint: t("filters.wilayaHint"),
    },
    { key: "categoryId", label: t("filters.category"), type: "select", options: categoryOptions },
    {
      key: "minRating",
      label: t("filters.rating"),
      type: "segmented",
      options: ["3.5", "4", "4.5"].map((r) => ({ value: r, label: `${r}+` })),
    },
    { key: "joined", label: t("filters.joinedBetween"), type: "daterange" },
    { key: "bookings", label: t("filters.completedBookings"), type: "range" },
    {
      key: "lastActive",
      label: t("filters.lastActive"),
      type: "select",
      options: ["7d", "30d", "90d", "never"].map((o) => ({
        value: o,
        label: t(`filters.lastActiveOptions.${o}`),
      })),
    },
    {
      key: "language",
      label: t("filters.language"),
      type: "segmented",
      options: [
        { value: "en", label: t("form.languages.en") },
        { value: "ar", label: t("form.languages.ar") },
      ],
    },
  ];

  const target = (u: UserRow): UserTarget => ({
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    email: u.email,
    businessName: u.businessName,
  });

  const columns: DataColumn<UserRow>[] = [
    {
      id: "fullName",
      header: t("columns.user"),
      sortable: true,
      hideable: false,
      cell: (u) => (
        <UserCell
          name={u.fullName}
          href={userHref(u)}
          sub={
            u.role === "provider" && u.businessName
              ? [u.businessName, u.category ? localName(u.category, locale) : null]
                  .filter(Boolean)
                  .join(" · ")
              : u.email
          }
        />
      ),
    },
    {
      id: "role",
      header: t("columns.role"),
      cell: (u) => <StatusBadgeCell domain="role" status={u.role} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (u) => <StatusBadgeCell domain="user" status={u.status} />,
    },
    {
      id: "verification",
      header: t("columns.verification"),
      cell: (u) =>
        u.verificationStatus === "not_required" ? (
          <span className="text-13 text-faint">{t("verification.not_required")}</span>
        ) : (
          <StatusBadge
            domain="document"
            status={verificationDomainStatus(u.verificationStatus)}
            label={t(`verification.${u.verificationStatus}`)}
          />
        ),
    },
    {
      id: "wilaya",
      header: t("columns.wilaya"),
      cell: (u) => <span className="text-13 text-ink">{u.wilaya ? localName(u.wilaya, locale) : "—"}</span>,
    },
    {
      id: "bookingsCount",
      header: t("columns.activity"),
      sortable: true,
      cell: (u) =>
        u.role === "provider" ? (
          <StackCell
            primary={
              <Link
                href={`/services?provider=${u.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand hover:underline"
              >
                {t("activity.services", { count: u.servicesCount ?? 0 })}
              </Link>
            }
            secondary={
              u.verificationStatus !== "verified" && (u.servicesCount ?? 0) > 0
                ? t("activity.hiddenUntilApproved")
                : [
                    t("activity.bookings", { count: u.bookingsCount }),
                    u.rating !== null && u.ratingCount ? `${u.rating.toFixed(1)}★` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
        ) : (
          <StackCell
            primary={
              <Link
                href={`/bookings?client=${u.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand hover:underline"
              >
                {t("activity.bookings", { count: u.bookingsCount })}
              </Link>
            }
            secondary={
              u.lastActiveAt
                ? t("activity.lastActive", { date: formatShort(u.lastActiveAt, locale) })
                : t("activity.neverActive")
            }
          />
        ),
    },
    {
      id: "createdAt",
      header: t("columns.joined"),
      sortable: true,
      cell: (u) => <DateCell value={u.createdAt} locale={locale} />,
    },
  ];

  const rowMenu = (u: UserRow) => {
    const provider = u.role === "provider";
    return [
      [
        { icon: <Eye />, label: t("menu.openProfile"), href: userHref(u) },
        ...(provider
          ? [
              {
                icon: <Briefcase />,
                label: t("menu.viewServices"),
                href: `/services?provider=${u.id}`,
                hint: u.servicesCount ?? 0,
              },
            ]
          : []),
        {
          icon: <CalendarDays />,
          label: t("menu.viewBookings"),
          href: provider ? `/bookings?provider=${u.id}` : `/bookings?client=${u.id}`,
          hint: u.bookingsCount,
        },
        {
          icon: <Star />,
          label: t("menu.viewReviews"),
          href: provider ? `/reviews?provider=${u.id}` : `/reviews?author=${u.id}`,
          hint: provider ? (u.ratingCount ?? 0) : undefined,
        },
        { icon: <MessageCircle />, label: t("menu.viewConversations"), href: `/messages?user=${u.id}` },
        { icon: <TriangleAlert />, label: t("menu.viewDisputes"), href: `/disputes?tab=all&userId=${u.id}` },
      ],
      [
        { icon: <Pencil />, label: t("menu.edit"), onSelect: () => void setDialog({ edit: u.id }) },
        ...(provider
          ? [{ icon: <Check />, label: t("menu.reviewDocuments"), href: `/verifications/${u.id}` }]
          : []),
        { icon: <Settings />, label: t("menu.resetPassword"), onSelect: () => setResetting(target(u)) },
        { icon: <LogOut />, label: t("menu.signOut"), onSelect: () => setSigningOut(target(u)) },
      ],
      [
        u.status === "blocked"
          ? {
              icon: <Unlock />,
              label: t("menu.unblock"),
              onSelect: () => setBulk({ action: "unblock", rows: [u], clear: () => undefined }),
            }
          : { icon: <Ban />, label: t("menu.block"), danger: true, onSelect: () => setBlocking(target(u)) },
        { icon: <Trash2 />, label: t("menu.delete"), danger: true, onSelect: () => setDeleting(u) },
      ],
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
            <Button icon={<Plus />} onClick={() => void setDialog({ new: "1" })}>
              {t("addUser")}
            </Button>
          </>
        }
      />
      <DataList<UserRow>
        resource={userKeys.all}
        queryFn={(p) => listUsers(usersQuery(p))}
        columns={columns}
        getRowId={(u) => u.id}
        tabs={[
          { key: "all", label: t("tabs.all") },
          { key: "clients", label: t("tabs.clients") },
          { key: "providers", label: t("tabs.providers") },
          { key: "awaiting_verification", label: t("tabs.awaiting_verification") },
          { key: "blocked", label: t("tabs.blocked") },
        ]}
        tabCounts={(r) => (r as UserList).meta.counts as unknown as Record<string, number>}
        defaultTab="all"
        filters={filters}
        advancedFilters={advancedFilters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "createdAt:desc", label: t("sort.newest") },
          { value: "createdAt:asc", label: t("sort.oldest") },
          { value: "fullName:asc", label: t("sort.name") },
          { value: "lastActiveAt:desc", label: t("sort.lastActive") },
          { value: "bookingsCount:desc", label: t("sort.mostBookings") },
          { value: "rating:desc", label: t("sort.rating") },
        ]}
        defaultSort="createdAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("users")}
        columnsStorageKey="users"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(u) => router.push(userHref(u))}
        rowMenuHeader={(u) => ({
          title: u.fullName,
          subtitle: [tr(u.role), u.businessName].filter(Boolean).join(" · "),
        })}
        rowMenu={rowMenu}
        bulkActions={(rows, clear) => (
          <>
            <Button variant="secondary" size="sm" icon={<FileText />} onClick={() => setExportOpen(true)}>
              {t("export")}
            </Button>
            <Button variant="secondary" size="sm" icon={<Bell />} disabled title={t("comingSoon")}>
              {t("bulk.notify")}
            </Button>
            {rows.some((r) => r.status === "blocked") && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Unlock />}
                onClick={() =>
                  setBulk({ action: "unblock", rows: rows.filter((r) => r.status === "blocked"), clear })
                }
              >
                {t("bulk.unblock")}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Ban />}
              disabled={!rows.some((r) => r.status === "active")}
              onClick={() =>
                setBulk({ action: "block", rows: rows.filter((r) => r.status === "active"), clear })
              }
            >
              {t("bulk.block")}
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              icon={<Trash2 />}
              onClick={() => setBulk({ action: "delete", rows, clear })}
            >
              {t("bulk.delete")}
            </Button>
          </>
        )}
        emptyState={
          <EmptyState
            icon={<Users />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="add" icon={<Plus />} onClick={() => void setDialog({ new: "1" })}>
                {t("addUser")}
              </Button>,
            ]}
          />
        }
      />

      <AddUserDialog
        open={dialog.new === "1"}
        onOpenChange={(o) => !o && void setDialog({ new: null })}
        onCreated={(u) => {
          void invalidate();
          router.push(userHref(u));
        }}
      />
      <EditUserDrawer
        user={editing.data ?? null}
        open={!!dialog.edit && !!editing.data}
        onOpenChange={(o) => !o && void setDialog({ edit: null })}
        onSaved={() => void invalidate()}
      />
      <BlockUserDialog
        user={blocking}
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        onBlocked={(result) => {
          const u = blocking!;
          void invalidate();
          toastBlocked(t, u, result, () => void invalidate());
        }}
      />
      <DeleteUserDialog
        user={deleting ? target(deleting) : null}
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        linked={
          deleting
            ? {
                bookings: deleting.bookingsCount,
                services: deleting.servicesCount,
                reviews: deleting.role === "provider" ? deleting.ratingCount : null,
              }
            : undefined
        }
        onDeleted={() => void invalidate()}
      />
      <ResetPasswordDialog
        user={resetting}
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
      />
      <SignOutEverywhereDialog
        user={signingOut}
        open={!!signingOut}
        onOpenChange={(o) => !o && setSigningOut(null)}
      />
      <BulkUsersDialog
        action={bulk?.action ?? null}
        users={(bulk?.rows ?? []).map((r) => ({
          ...target(r),
          servicesCount: r.servicesCount,
          bookingsCount: r.bookingsCount,
        }))}
        onOpenChange={(o) => !o && setBulk(null)}
        onDone={() => {
          bulk?.clear();
          void invalidate();
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="users"
        title={t("exportTitle")}
        filters={params ? exportFilters(params) : {}}
        summary={t("exportSummary", {
          count: formatNumber(stats.data?.meta.total ?? 0, locale),
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "fullName", label: t("exportColumns.fullName") },
          { key: "email", label: t("exportColumns.email") },
          { key: "phone", label: t("exportColumns.phone") },
          { key: "role", label: t("exportColumns.role") },
          { key: "status", label: t("exportColumns.status") },
          { key: "verificationStatus", label: t("exportColumns.verificationStatus") },
          { key: "wilaya", label: t("exportColumns.wilaya") },
          { key: "businessName", label: t("exportColumns.businessName"), defaultChecked: false },
          { key: "category", label: t("exportColumns.category"), defaultChecked: false },
          { key: "bookingsCount", label: t("exportColumns.bookingsCount") },
          { key: "rating", label: t("exportColumns.rating"), defaultChecked: false },
          { key: "lastActiveAt", label: t("exportColumns.lastActiveAt"), defaultChecked: false },
          { key: "createdAt", label: t("exportColumns.createdAt") },
        ]}
      />
    </>
  );
}

function formatShort(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

/** List params → export filters, same names as `GET /admin/users`. */
function exportFilters(p: ListParams): Record<string, unknown> {
  const q = usersQuery(p);
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
