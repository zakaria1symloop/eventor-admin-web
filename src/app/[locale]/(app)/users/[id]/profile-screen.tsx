"use client";

import { ReviewsCard } from "../../reviews/reviews-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Construction,
  Eye,
  FileText,
  Layers,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Settings,
  Star,
  Trash2,
  Unlock,
  UserRound,
  UserX,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Textarea } from "@/components/forms/fields";
import { DetailHeader, LinkedCounts, TwoColumn, type LinkedCount } from "@/components/layout/detail";
import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValueList } from "@/components/ui/key-value-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { listPacks, packKeys } from "@/lib/api/packs";
import { listServices, serviceKeys } from "@/lib/api/services";
import {
  addNote,
  deleteNote,
  unblockUser,
  userKeys,
  type DocumentType,
  type UserDetail,
  type UserNote,
} from "@/lib/api/users";
import { cn } from "@/lib/utils/cn";
import {
  formatCompactMoney,
  formatDate,
  formatDateTime,
  formatDzPhone,
  formatMoney,
  formatNumber,
  formatRelative,
  initials,
} from "@/lib/utils/format";
import {
  BLOCK_REASONS,
  BlockUserDialog,
  DeleteUserDialog,
  ResetPasswordDialog,
  SignOutEverywhereDialog,
  toastBlocked,
  type UserTarget,
} from "../user-dialogs";
import { EditUserDrawer } from "../user-form-dialogs";
import { localName } from "../use-user-options";
import { useUser } from "../use-user";
import { verificationDomainStatus } from "../users-screen";

type Overlay = "block" | "delete" | "reset" | "signout" | "unblock" | null;

export function ProfileScreen({ id }: { id: string }) {
  const t = useTranslations("users");
  const tp = useTranslations("users.profile");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useUser(id);
  const [edit, setEdit] = useQueryState("edit", parseAsString.withOptions({ history: "replace" }));
  const [overlay, setOverlay] = useState<Overlay>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: userKeys.all });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <CardSkeleton className="h-[180px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_370px]">
          <CardSkeleton className="h-[320px]" />
          <CardSkeleton className="h-[320px]" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/users" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<UserX />}
              title={tp("notFoundTitle")}
              description={tp("notFoundDescription")}
              actions={[
                <Button key="back" variant="secondary" onClick={() => router.push("/users")}>
                  {tp("backToUsers")}
                </Button>,
              ]}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    );
  }

  const u = query.data;
  const provider = u.role === "provider";
  const target: UserTarget = {
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    email: u.email,
    businessName: u.businessName,
  };
  const blocked = u.status === "blocked";
  const categoryName = localName(u.provider?.category ?? u.category, locale);

  const actionsMenu: ActionMenuItem[][] = [
    [
      { icon: <Eye />, label: tp("actions.viewAsClient"), disabled: true, hint: tp("soon") },
      { icon: <MessageCircle />, label: tp("actions.openConversation"), href: `/messages?user=${u.id}` },
      ...(provider
        ? [{ icon: <Plus />, label: tp("actions.addService"), href: `/services/new?provider=${u.id}` }]
        : []),
      ...(provider
        ? []
        : [{ icon: <CalendarDays />, label: tp("actions.createBooking"), href: `/bookings?new=1` }]),
    ],
    [
      ...(provider
        ? [{ icon: <FileText />, label: t("menu.reviewDocuments"), href: `/verifications/${u.id}` }]
        : []),
      { icon: <Settings />, label: t("menu.resetPassword"), onSelect: () => setOverlay("reset") },
      { icon: <LogOut />, label: t("menu.signOut"), onSelect: () => setOverlay("signout") },
      { icon: <UserRound />, label: tp("actions.impersonate"), disabled: true, hint: tp("soon") },
    ],
    [
      blocked
        ? { icon: <Unlock />, label: t("menu.unblock"), onSelect: () => setOverlay("unblock") }
        : { icon: <Ban />, label: tp("actions.block"), danger: true, onSelect: () => setOverlay("block") },
      { icon: <Trash2 />, label: tp("actions.delete"), danger: true, onSelect: () => setOverlay("delete") },
    ],
  ];

  const s = u.stats;
  const counts: LinkedCount[] = provider
    ? [
        {
          label: tp("counts.services"),
          value: formatNumber(s.services?.total ?? 0, locale),
          hint: tp("counts.servicesHint", {
            published: s.services?.published ?? 0,
            hidden: s.services?.hidden ?? 0,
          }),
          href: `/services?provider=${u.id}`,
        },
        {
          label: tp("counts.bookings"),
          value: formatNumber(s.bookings.total, locale),
          hint: tp("counts.bookingsHint", { pending: s.bookings.pending, upcoming: s.bookings.upcoming }),
          href: `/bookings?provider=${u.id}`,
        },
        {
          label: tp("counts.earned"),
          value: formatCompactMoney(s.earnings, locale),
          hint: tp("counts.completedBookings"),
          href: `/bookings?provider=${u.id}&status=completed`,
        },
        {
          label: tp("counts.rating"),
          value: s.reviews.avg !== null ? s.reviews.avg.toFixed(1) : "—",
          hint: tp("counts.ratingHint", { count: s.reviews.count, reported: s.reviews.reported }),
          href: `/reviews?provider=${u.id}`,
        },
        {
          label: tp("counts.replyRate"),
          value: s.replyRate !== null ? `${s.replyRate}%` : "—",
          hint:
            u.provider?.avgReplyMinutes != null
              ? tp("counts.avgReply", { minutes: u.provider.avgReplyMinutes })
              : undefined,
          href: `/messages?user=${u.id}`,
        },
        {
          label: tp("counts.packs"),
          value: formatNumber(s.packs?.total ?? 0, locale),
          hint: tp("counts.packsHint", { published: s.packs?.published ?? 0 }),
          href: `/packs?provider=${u.id}`,
        },
      ]
    : [
        {
          label: tp("counts.bookings"),
          value: formatNumber(s.bookings.total, locale),
          hint: tp("counts.bookingsHint", { pending: s.bookings.pending, upcoming: s.bookings.upcoming }),
          href: `/bookings?client=${u.id}`,
        },
        {
          label: tp("counts.spent"),
          value: formatCompactMoney(s.earnings, locale),
          hint: tp("counts.completedBookings"),
          href: `/bookings?client=${u.id}&status=completed`,
        },
        {
          label: tp("counts.reviewsWritten"),
          value: formatNumber(s.reviews.count, locale),
          hint: s.reviews.avg !== null ? tp("counts.avgGiven", { avg: s.reviews.avg.toFixed(1) }) : undefined,
          href: `/reviews?author=${u.id}`,
        },
        {
          label: tp("counts.disputes"),
          value: formatNumber(s.disputes.total, locale),
          hint: tp("counts.disputesHint", { open: s.disputes.open }),
          href: `/disputes?tab=all&userId=${u.id}`,
        },
        {
          label: tp("counts.cancellations"),
          value: formatNumber(s.bookings.cancelled, locale),
          hint: tp("counts.cancellationsHint"),
          href: `/bookings?client=${u.id}&status=cancelled`,
        },
        {
          label: tp("counts.completed"),
          value: formatNumber(s.bookings.completed, locale),
          hint: tp("counts.completedHint"),
          href: `/bookings?client=${u.id}&status=completed`,
        },
      ];

  const meta = [
    provider && u.provider
      ? { icon: <Building2 />, label: [u.provider.businessName, categoryName].filter(Boolean).join(" · ") }
      : null,
    u.wilaya ? { icon: <MapPin />, label: localName(u.wilaya, locale) } : null,
    { icon: <CalendarDays />, label: tp("joined", { date: formatDate(u.createdAt, locale) }) },
    {
      icon: <Eye />,
      label: u.lastActiveAt
        ? tp("lastActive", { when: formatRelative(u.lastActiveAt, locale) })
        : tp("neverActive"),
    },
  ].filter((m): m is NonNullable<typeof m> => m !== null);

  const listTab = provider ? "providers" : "clients";

  return (
    <>
      <PageHeader
        back
        breadcrumb={[
          { label: t("title"), href: "/users" },
          { label: t(`tabs.${listTab}`), href: `/users?tab=${listTab}` },
          { label: u.fullName },
        ]}
        className="mb-4"
      />

      {blocked && u.block && (
        <Banner
          tone="red"
          icon={<Ban />}
          className="mb-4 border border-red/20 py-3.5"
          title={
            u.block.blockedBy
              ? tp("blockedBy", {
                  name: u.block.blockedBy.fullName,
                  date: formatDateTime(u.block.blockedAt, locale),
                })
              : tp("blockedAt", { date: formatDateTime(u.block.blockedAt, locale) })
          }
          description={[
            u.block.reason ? tp("blockReason", { reason: reasonLabel(t, u.block.reason) }) : null,
            u.block.until
              ? tp("blockUntil", { date: formatDate(u.block.until, locale) })
              : tp("blockIndefinite"),
            provider && s.services?.published ? tp("servicesHidden", { count: s.services.published }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          action={
            <Button variant="secondary" icon={<Check />} onClick={() => setOverlay("unblock")}>
              {tp("unblock")}
            </Button>
          }
        />
      )}

      <DetailHeader
        avatar={{ name: u.fullName, src: u.avatarUrl }}
        title={u.fullName}
        badges={[
          <StatusBadge key="role" domain="role" status={u.role} />,
          <StatusBadge key="status" domain="user" status={u.status} />,
          ...(provider
            ? [
                <StatusBadge
                  key="verification"
                  domain="document"
                  status={verificationDomainStatus(u.verificationStatus)}
                  label={t(`verification.${u.verificationStatus}`)}
                />,
              ]
            : []),
        ]}
        meta={meta}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<MessageCircle />}
              onClick={() => router.push(`/messages?new=1&to=${u.id}`)}
            >
              {tp("message")}
            </Button>
            <Button variant="secondary" icon={<Pencil />} onClick={() => void setEdit("1")}>
              {tp("editDetails")}
            </Button>
            <ActionMenu
              groups={actionsMenu}
              trigger={<Button icon={<ChevronDown />}>{tp("actionsMenu")}</Button>}
            />
          </>
        }
      >
        <LinkedCounts items={counts} />
      </DetailHeader>

      <ProfileTabs user={u} onOverlay={setOverlay} />

      <EditUserDrawer
        user={u}
        open={edit === "1"}
        onOpenChange={(o) => !o && void setEdit(null)}
        onSaved={() => void invalidate()}
      />
      <BlockUserDialog
        user={target}
        open={overlay === "block"}
        onOpenChange={(o) => !o && setOverlay(null)}
        onBlocked={(result) => {
          void invalidate();
          toastBlocked(t, target, result, () => void invalidate());
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <DeleteUserDialog
        user={target}
        open={overlay === "delete"}
        onOpenChange={(o) => !o && setOverlay(null)}
        linked={{
          bookings: s.bookings.total,
          services: provider ? (s.services?.total ?? 0) : null,
          reviews: s.reviews.count,
        }}
        onDeleted={() => {
          void invalidate();
          router.push("/users");
        }}
      />
      <ResetPasswordDialog
        user={target}
        open={overlay === "reset"}
        onOpenChange={(o) => !o && setOverlay(null)}
      />
      <SignOutEverywhereDialog
        user={target}
        open={overlay === "signout"}
        onOpenChange={(o) => !o && setOverlay(null)}
      />
      <ConfirmDialog
        open={overlay === "unblock"}
        onOpenChange={(o) => !o && setOverlay(null)}
        icon={<Unlock />}
        title={tp("unblockTitle", { name: u.fullName })}
        description={provider ? tp("unblockDescriptionProvider") : tp("unblockDescriptionClient")}
        confirmLabel={tp("unblock")}
        onConfirm={async () => {
          await unblockUser(u.id);
          toast.success(t("unblockedToast", { name: u.fullName }));
          void invalidate();
        }}
      />
    </>
  );
}

export function reasonLabel(t: (key: string) => string, reason: string) {
  return (BLOCK_REASONS as readonly string[]).includes(reason) ? t(`reasons.${reason}`) : reason;
}

/* ------------------------------------------------------------------ tabs */

function ProfileTabs({ user: u, onOverlay }: { user: UserDetail; onOverlay: (o: Overlay) => void }) {
  const tp = useTranslations("users.profile");
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("overview").withOptions({ history: "replace" }),
  );
  const provider = u.role === "provider";
  const s = u.stats;
  const items = provider
    ? [
        { key: "overview", label: tp("tabs.overview") },
        { key: "documents", label: tp("tabs.documents"), count: u.documents?.items.length ?? 3 },
        { key: "services", label: tp("tabs.services"), count: s.services?.total ?? 0 },
        { key: "bookings", label: tp("tabs.bookings"), count: s.bookings.total },
        { key: "reviews", label: tp("tabs.reviews"), count: s.reviews.count },
        { key: "messages", label: tp("tabs.messages") },
        { key: "packs", label: tp("tabs.packs"), count: s.packs?.total ?? 0 },
        { key: "activity", label: tp("tabs.activity") },
      ]
    : [
        { key: "overview", label: tp("tabs.overview") },
        { key: "bookings", label: tp("tabs.bookings"), count: s.bookings.total },
        { key: "reviews", label: tp("tabs.reviewsWritten"), count: s.reviews.count },
        { key: "messages", label: tp("tabs.messages") },
        { key: "activity", label: tp("tabs.activity") },
      ];
  const current = items.some((i) => i.key === tab) ? tab : "overview";
  const soon: Record<string, { module: number; href: string }> = {
    bookings: { module: 8, href: provider ? `/bookings?provider=${u.id}` : `/bookings?client=${u.id}` },
    messages: { module: 11, href: `/messages?user=${u.id}` },
    activity: { module: 2, href: `/activity-log?objectId=${u.id}` },
  };

  return (
    <>
      <Tabs
        items={items}
        value={current}
        onChange={(k) => void setTab(k === "overview" ? null : k)}
        className="mb-4 [&>[role=tablist]]:px-1"
        aria-label={tp("tabsLabel")}
      />
      {current === "overview" && <Overview user={u} onOverlay={onOverlay} />}
      {current === "documents" && (
        <div className="max-w-[640px]">
          <DocumentsCard user={u} />
        </div>
      )}
      {current === "services" && <ProviderServicesTab providerId={u.id} />}
      {current === "packs" && <ProviderPacksTab providerId={u.id} />}
      {current === "reviews" && (
        <ReviewsCard scope={provider ? { providerId: u.id } : { authorId: u.id }} written={!provider} />
      )}
      {soon[current] && (
        <Card>
          <EmptyState
            icon={<Construction />}
            title={tp("comingSoonTitle")}
            description={tp("comingSoonDescription", { module: soon[current].module })}
            actions={
              current === "activity"
                ? [
                    <Link
                      key="log"
                      href={soon[current].href}
                      className="text-13 font-medium text-brand hover:underline"
                    >
                      {tp("openActivityLog")}
                    </Link>,
                  ]
                : undefined
            }
          />
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ services / packs tabs (modules 6–7) */

function ProviderServicesTab({ providerId }: { providerId: string }) {
  const tp = useTranslations("users.profile");
  const locale = useLocale();
  const query = useQuery({
    queryKey: [...serviceKeys.all, "provider-tab", providerId],
    queryFn: () => listServices({ providerId, limit: 10, sort: "createdAt:desc" }),
  });
  return (
    <Card>
      <CardHeader
        title={tp("services")}
        subtitle={query.data ? tp("servicesTotal", { count: query.data.meta.total }) : undefined}
        actions={
          <>
            <Link
              href={`/services/new?provider=${providerId}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-13 font-medium text-ink hover:bg-canvas"
            >
              <Plus className="size-4" aria-hidden /> {tp("actions.addService")}
            </Link>
            <span className="text-13 font-medium text-brand">
              <SectionLink href={`/services?provider=${providerId}`}>{tp("openInServices")}</SectionLink>
            </span>
          </>
        }
      />
      {query.isPending ? (
        <p className="px-[18px] py-6 text-13 text-muted">{tp("loading")}</p>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState icon={<Camera />} title={tp("noServices")} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data.data.map((sv) => (
            <li key={sv.id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
              {sv.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sv.coverUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Camera className="size-4" aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1 leading-tight">
                <Link
                  href={`/services/${sv.id}`}
                  className="block truncate text-14 font-medium text-brand hover:underline"
                >
                  {locale === "ar" ? sv.titleAr || sv.titleEn : sv.titleEn || sv.titleAr}
                </Link>
                <span className="block truncate text-12 text-muted">
                  {tp("from", { price: formatMoney(sv.basePrice, locale) })} ·{" "}
                  {localName(sv.category, locale)}
                </span>
              </span>
              <span className="inline-flex w-16 items-center gap-1 text-13 text-ink-2 tabular-nums">
                <Star className="size-3.5 text-gold" aria-hidden />
                {sv.ratingCount ? sv.rating.toFixed(1) : "—"}
              </span>
              <StatusBadge domain="service" status={sv.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProviderPacksTab({ providerId }: { providerId: string }) {
  const tp = useTranslations("users.profile");
  const locale = useLocale();
  const query = useQuery({
    queryKey: [...packKeys.all, "provider-tab", providerId],
    queryFn: () => listPacks({ providerId, limit: 10, sort: "createdAt:desc" }),
  });
  return (
    <Card>
      <CardHeader
        title={tp("packs")}
        actions={
          <>
            <Link
              href={`/packs/new?provider=${providerId}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-13 font-medium text-ink hover:bg-canvas"
            >
              <Plus className="size-4" aria-hidden /> {tp("createPack")}
            </Link>
            <span className="text-13 font-medium text-brand">
              <SectionLink href={`/packs?provider=${providerId}`}>{tp("openInPacks")}</SectionLink>
            </span>
          </>
        }
      />
      {query.isPending ? (
        <p className="px-[18px] py-6 text-13 text-muted">{tp("loading")}</p>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState icon={<Layers />} title={tp("noPacks")} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data.data.map((pk) => (
            <li key={pk.id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
              <Layers className="size-4 text-brand" aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                <Link
                  href={`/packs/${pk.id}`}
                  className="block truncate text-14 font-medium text-brand hover:underline"
                >
                  {locale === "ar" ? pk.nameAr || pk.nameEn : pk.nameEn || pk.nameAr}
                </Link>
                <span className="block truncate text-12 text-muted">
                  {tp("packLine", { count: pk.itemsCount, price: formatMoney(pk.price, locale) })}
                </span>
              </span>
              {pk.needsAttention && (
                <StatusBadge domain="pack" status="needs_attention" label={tp("needsAttention")} />
              )}
              <StatusBadge domain="pack" status={pk.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ overview */

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:underline">
      {children}
      <ChevronRight className="flip-rtl size-4" aria-hidden />
    </Link>
  );
}

function Overview({ user: u, onOverlay }: { user: UserDetail; onOverlay: (o: Overlay) => void }) {
  const tp = useTranslations("users.profile");
  const locale = useLocale();
  const provider = u.role === "provider";
  const r = u.recent;

  const main = (
    <>
      {provider && (
        <Card>
          <CardHeader
            title={tp("services")}
            action={<SectionLink href={`/services?provider=${u.id}`}>{tp("openInServices")}</SectionLink>}
          />
          {r.services.length === 0 ? (
            <p className="px-[18px] py-6 text-13 text-muted">{tp("noServices")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {r.services.map((sv) => (
                <li key={sv.id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                    <Camera className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <Link
                      href={`/services/${sv.id}`}
                      className="block truncate text-14 font-medium text-brand hover:underline"
                    >
                      {locale === "ar" ? sv.titleAr || sv.titleEn : sv.titleEn || sv.titleAr}
                    </Link>
                    <span className="block truncate text-12 text-muted">
                      {tp("from", { price: formatMoney(sv.basePrice, locale) })}
                    </span>
                  </span>
                  <span className="inline-flex w-16 items-center gap-1 text-13 text-ink-2 tabular-nums">
                    <Star className="size-3.5 text-gold" aria-hidden />
                    {sv.avgRating > 0 ? sv.avgRating.toFixed(1) : "—"}
                  </span>
                  <span className="w-24 text-13 text-brand">
                    {tp("bookingsCount", { count: sv.bookingsCount })}
                  </span>
                  <StatusBadge domain="service" status={sv.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          title={tp("recentBookings")}
          action={
            <SectionLink href={provider ? `/bookings?provider=${u.id}` : `/bookings?client=${u.id}`}>
              {tp("allBookings", { count: u.stats.bookings.total })}
            </SectionLink>
          }
        />
        {r.bookings.length === 0 ? (
          <p className="px-[18px] py-6 text-13 text-muted">{tp("noBookings")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {r.bookings.map((b) => (
              <li
                key={b.id}
                className="grid grid-cols-2 items-center gap-3 px-[18px] py-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
              >
                <span className="min-w-0 leading-tight">
                  <span className="block text-14 font-medium text-brand">#{b.reference}</span>
                  {b.title && <span className="block truncate text-12 text-muted">{b.title}</span>}
                </span>
                <Link
                  href={`/users/${b.counterpart.id}`}
                  className="truncate text-13 font-medium text-brand hover:underline"
                >
                  {b.counterpart.fullName}
                </Link>
                <span className="text-13 whitespace-nowrap text-ink-2">
                  {formatDate(b.eventDate, locale)} ·{" "}
                  <span className="font-semibold text-ink" dir="ltr">
                    {formatMoney(b.total, locale)}
                  </span>
                </span>
                <StatusBadge domain="booking" status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={provider ? tp("latestReviews") : tp("reviewsWrote")}
          action={
            <SectionLink href={provider ? `/reviews?provider=${u.id}` : `/reviews?author=${u.id}`}>
              {tp("allReviews", { count: u.stats.reviews.count })}
            </SectionLink>
          }
        />
        {r.reviews.length === 0 ? (
          <p className="px-[18px] py-6 text-13 text-muted">{tp("noReviews")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {r.reviews.map((rv) => {
              const person = provider ? rv.author : rv.provider;
              return (
                <li key={rv.id} className="flex gap-3 px-[18px] py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-soft text-12 font-semibold text-blue">
                    {initials(person.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-13">
                      <Link href={`/users/${person.id}`} className="font-medium text-brand hover:underline">
                        {person.fullName}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-ink tabular-nums">
                        <Star className="size-3.5 text-gold" aria-hidden />
                        {rv.rating.toFixed(1)}
                      </span>
                      <span className="text-12 text-faint">· {formatDate(rv.createdAt, locale)}</span>
                      {rv.status !== "published" && <StatusBadge domain="review" status={rv.status} />}
                    </div>
                    <p className="mt-0.5 text-13 text-ink">“{rv.comment}”</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );

  const aside = (
    <>
      <AccountDetailsCard user={u} />
      {provider && <DocumentsCard user={u} />}
      <NotesCard user={u} />
      <AccountControlsCard user={u} onOverlay={onOverlay} />
    </>
  );

  return <TwoColumn main={main} aside={aside} />;
}

function AccountDetailsCard({ user: u }: { user: UserDetail }) {
  const tp = useTranslations("users.profile");
  const tf = useTranslations("users.form");
  const locale = useLocale();
  const [, setEdit] = useQueryState("edit", parseAsString.withOptions({ history: "replace" }));
  const provider = u.role === "provider";
  const rows = [
    { label: tf("email"), value: u.email },
    { label: tf("phone"), value: u.phone ? <span dir="ltr">{formatDzPhone(u.phone)}</span> : "—" },
    ...(provider && u.provider
      ? [
          { label: tp("business"), value: u.provider.businessName, href: `/services?provider=${u.id}` },
          { label: tf("category"), value: localName(u.provider.category, locale) || "—" },
          {
            label: tf("wilayasServed"),
            value: u.provider.wilayas.map((w) => localName(w, locale)).join(", ") || "—",
          },
        ]
      : [
          { label: tf("wilaya"), value: u.wilaya ? localName(u.wilaya, locale) : "—" },
          { label: tp("budget"), value: tp("budgetPrivate") },
        ]),
    { label: tf("language"), value: tf(`languages.${u.language}`) },
    {
      label: tp("emailVerified"),
      value: u.emailVerifiedAt ? formatDate(u.emailVerifiedAt, locale) : tp("notVerified"),
    },
    { label: tp("userId"), value: <span className="font-mono text-12">{u.id.slice(0, 8)}</span> },
  ];
  return (
    <Card>
      <CardHeader
        title={tp("accountDetails")}
        action={
          <button
            type="button"
            onClick={() => void setEdit("1")}
            className="inline-flex items-center gap-1 hover:underline"
          >
            {tp("edit")} <Pencil className="size-3.5" aria-hidden />
          </button>
        }
      />
      <CardBody className="py-2">
        <KeyValueList rows={rows} />
      </CardBody>
    </Card>
  );
}

export function documentTypeLabel(t: (k: string) => string, type: DocumentType) {
  return t(`documentTypes.${type}`);
}

function DocumentsCard({ user: u }: { user: UserDetail }) {
  const tp = useTranslations("users.profile");
  const tu = useTranslations("users");
  const d = u.documents;
  const total = d?.items.length ?? 3;
  const approved = d?.progress.approved ?? 0;
  return (
    <Card>
      <CardHeader
        title={tp("documents")}
        actions={
          <Pill tone={approved === total ? "green" : d?.progress.rejected ? "red" : "amber"}>
            {tp("approvedOf", { approved, total })}
          </Pill>
        }
      />
      <ul className="divide-y divide-border">
        {(d?.items ?? []).map((doc) => (
          <li key={doc.type} className="flex items-center gap-3 px-[18px] py-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                doc.status === "approved"
                  ? "bg-green-soft text-green"
                  : doc.status === "rejected"
                    ? "bg-red-soft text-red"
                    : doc.status === "pending"
                      ? "bg-amber-soft text-amber"
                      : "bg-gray-soft text-muted",
              )}
            >
              <FileText className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-13 font-medium text-ink">{documentTypeLabel(tu, doc.type)}</span>
              <span className="block text-12 text-muted">{tu(`documentStatus.${doc.status}`)}</span>
            </span>
            {doc.status !== "missing" && (
              <Link
                href={`/verifications/${u.id}?doc=${doc.type}`}
                aria-label={tp("viewDocument", { type: documentTypeLabel(tu, doc.type) })}
                className="flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-gray-soft"
              >
                <Eye className="size-[18px]" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-[18px] py-3 text-13 font-medium text-brand">
        <SectionLink href={`/verifications/${u.id}`}>{tp("reviewDocuments")}</SectionLink>
      </div>
    </Card>
  );
}

function NotesCard({ user: u }: { user: UserDetail }) {
  const tp = useTranslations("users.profile");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const [removing, setRemoving] = useState<UserNote | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: userKeys.detail(u.id) });
  const add = useMutation({
    mutationFn: (text: string) => addNote(u.id, text),
    onSuccess: () => {
      setBody("");
      setAdding(false);
      toast.success(tp("noteAdded"));
      void refresh();
    },
    onError: (e) => toast.apiError(e),
  });
  const notes = u.recent.notes;
  return (
    <Card>
      <CardHeader
        title={tp("notes")}
        action={
          !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {tp("addNote")} <Plus className="size-4" aria-hidden />
            </button>
          )
        }
      />
      <CardBody className="flex flex-col gap-3">
        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) add.mutate(body.trim());
            }}
            className="flex flex-col gap-2"
          >
            <Textarea
              aria-label={tp("addNote")}
              value={body}
              maxLength={5000}
              autoFocus
              placeholder={tp("notePlaceholder")}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAdding(false)} disabled={add.isPending}>
                {tc("cancel")}
              </Button>
              <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
                {tp("saveNote")}
              </Button>
            </div>
          </form>
        )}
        {notes.length === 0 && !adding && <p className="text-13 text-muted">{tp("noNotes")}</p>}
        {notes.map((n) => (
          <div key={n.id} className="group flex gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-13 whitespace-pre-line text-ink">{n.body}</p>
              <p className="mt-0.5 text-12 text-faint">
                {n.author.fullName} · {formatDate(n.createdAt, locale)} · {tp("onlyAdmins")}
              </p>
            </div>
            {n.canDelete && (
              <IconButton
                label={tp("deleteNote")}
                size="sm"
                className="text-muted opacity-60 group-hover:opacity-100"
                onClick={() => setRemoving(n)}
              >
                <Trash2 />
              </IconButton>
            )}
          </div>
        ))}
      </CardBody>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        tone="danger"
        icon={<Trash2 />}
        title={tp("deleteNoteTitle")}
        description={removing?.body}
        confirmLabel={tp("deleteNote")}
        onConfirm={async () => {
          await deleteNote(u.id, removing!.id);
          toast.success(tp("noteDeleted"));
          void refresh();
        }}
      />
    </Card>
  );
}

function AccountControlsCard({
  user: u,
  onOverlay: fire,
}: {
  user: UserDetail;
  onOverlay: (o: Overlay) => void;
}) {
  const tp = useTranslations("users.profile");
  const blocked = u.status === "blocked";
  const provider = u.role === "provider";
  const s = u.stats;
  return (
    <Card className="border-red/30">
      <CardHeader title={<span className="text-red">{tp("controls")}</span>} className="border-b-0 pb-0" />
      <CardBody className="flex flex-col gap-3">
        <p className="text-13 text-ink-2">
          {provider
            ? tp("controlsProvider", { services: s.services?.published ?? 0, pending: s.bookings.pending })
            : tp("controlsClient", { upcoming: s.bookings.upcoming })}
        </p>
        <div className="flex flex-wrap gap-2">
          {blocked ? (
            <Button variant="secondary" icon={<Unlock />} onClick={() => fire("unblock")}>
              {tp("unblock")}
            </Button>
          ) : (
            <Button variant="danger-outline" icon={<Ban />} onClick={() => fire("block")}>
              {tp("actions.block")}
            </Button>
          )}
          <Button variant="secondary" icon={<Trash2 />} onClick={() => fire("delete")}>
            {tp("deleteShort")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
