"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  Flag,
  MessageSquareOff,
  Star,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  DataList,
  LinkCell,
  UserCell,
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
import { SegmentedControl } from "@/components/forms/inputs";
import { PageHeader } from "@/components/layout/page-header";
import type { ActionMenuItem } from "@/components/ui/action-menu";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { getOverview, overviewKeys } from "@/lib/api/overview";
import {
  listReviews,
  moderateReview,
  REVIEW_TABS,
  reviewKeys,
  reviewsQuery,
  type ReviewList,
  type ReviewRow,
} from "@/lib/api/reviews";
import { savedViewsSource } from "@/lib/api/saved-views";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { useCatalog } from "../services/use-service-options";
import { ReportsList } from "./reports-list";
import { DeleteReviewDialog } from "./review-dialogs";
import { ReviewDrawer, ReviewStatusPill } from "./review-drawer";

const TAB_OPTIONS = REVIEW_TABS;
const day = (offset: number) => new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10);

export function offerTitle(r: Pick<ReviewRow, "service" | "pack">, locale: string) {
  if (r.service)
    return locale === "ar" ? r.service.titleAr || r.service.titleEn : r.service.titleEn || r.service.titleAr;
  if (r.pack) return locale === "ar" ? r.pack.nameAr || r.pack.nameEn : r.pack.nameEn || r.pack.nameAr;
  return "—";
}

export function ReviewsScreen() {
  const t = useTranslations("reviews");
  const tp = useTranslations("pages.reviews");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const [view] = useQueryState("view", parseAsString.withOptions({ history: "replace" }));
  const [reviewId, setReviewId] = useQueryState("review", parseAsString.withOptions({ history: "push" }));
  const [deleting, setDeleting] = useState<ReviewRow | null>(null);
  const [dismissing, setDismissing] = useState<ReviewRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);
  const reportsView = view === "reports";

  const [weekAgo] = useState(() => day(7));
  const [twoWeeksAgo] = useState(() => day(14));
  const [lastWeekEnd] = useState(() => day(8));
  const stats = useQuery({
    queryKey: [...reviewKeys.all, "stats"],
    queryFn: () => listReviews({ limit: 1 }),
  });
  const week = useQuery({
    queryKey: [...reviewKeys.all, "stats", "week", weekAgo],
    queryFn: () => listReviews({ limit: 1, createdFrom: weekAgo }),
  });
  const prevWeek = useQuery({
    queryKey: [...reviewKeys.all, "stats", "prev-week", twoWeeksAgo],
    queryFn: () => listReviews({ limit: 1, createdFrom: twoWeeksAgo, createdTo: lastWeekEnd }),
  });
  const overview = useQuery({
    queryKey: overviewKeys.detail({ range: "30d" }),
    queryFn: () => getOverview({ range: "30d" }),
    staleTime: 60_000,
  });
  const counts = stats.data?.meta.counts;
  const v = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n, locale));
  const avg = overview.data?.kpis.find((k) => k.key === "average_rating");
  const weekCount = week.data?.meta.counts.all;
  const prevCount = prevWeek.data?.meta.counts.all;
  const weekDelta =
    weekCount !== undefined && prevCount ? Math.round(((weekCount - prevCount) / prevCount) * 100) : null;

  const quickFilters: QuickFilterItem[] = [
    {
      key: "average",
      label: t("stats.average"),
      value: avg?.value ? Number(avg.value).toFixed(1) : "—",
      hint: t("stats.averageHint", { count: formatNumber(counts?.published ?? 0, locale) }),
      tone: "gold",
      filter: { status: null, created: null },
    },
    {
      key: "reported",
      label: t("stats.reported"),
      value: v(counts?.reported),
      hint: t("stats.reportedHint"),
      tone: "red",
      filter: { status: "reported", created: null },
    },
    {
      key: "hidden",
      label: t("stats.hidden"),
      value: v(counts?.hidden),
      hint: t("stats.hiddenHint"),
      tone: "gray",
      filter: { status: "hidden", created: null },
    },
    {
      key: "week",
      label: t("stats.week"),
      value: v(weekCount),
      hint:
        weekDelta === null
          ? t("stats.weekHint")
          : t("stats.weekDelta", { delta: `${weekDelta > 0 ? "+" : ""}${weekDelta}` }),
      tone: "brand",
      filter: { created: `${weekAgo}..`, status: null },
    },
  ];

  const selected = () => t("filters.selected");
  const ratingOptions = [5, 4, 3, 2, 1].map((n) => ({
    value: String(n),
    label: t("filters.stars", { count: n }),
  }));
  const yesNo = [
    { value: "true", label: t("filters.yes") },
    { value: "false", label: t("filters.no") },
  ];
  const filters: FilterConfig[] = [
    { key: "rating", label: t("filters.rating"), multiple: true, options: ratingOptions },
    { key: "provider", label: t("filters.provider"), options: catalog.providerOptions },
    { key: "flagged", label: t("filters.flagged"), options: yesNo },
    { key: "hadDispute", label: t("filters.hadDispute"), options: yesNo },
    // URL-only filters (quick cards, profile / service / pack links).
    {
      key: "status",
      label: t("filters.status"),
      options: TAB_OPTIONS.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`tabs.${s}`) })),
    },
    { key: "service", label: t("filters.service"), options: [], format: selected },
    { key: "pack", label: t("filters.pack"), options: [], format: selected },
    { key: "author", label: t("filters.author"), options: [], format: selected },
  ];
  const advancedFilters: AdvancedFilterField[] = [
    { key: "rating", label: t("filters.rating"), type: "multiselect", options: ratingOptions },
    { key: "provider", label: t("filters.provider"), type: "select", options: catalog.providerOptions },
    { key: "flagged", label: t("filters.flagged"), type: "segmented", options: yesNo },
    { key: "hadDispute", label: t("filters.hadDispute"), type: "segmented", options: yesNo },
    { key: "created", label: t("filters.created"), type: "daterange" },
  ];

  const columns: DataColumn<ReviewRow>[] = [
    {
      id: "review",
      header: t("columns.review"),
      hideable: false,
      cell: (r) => (
        <div className="max-w-[380px] min-w-[220px]">
          <UserCell
            name={r.author.fullName}
            href={`/users/${r.author.id}`}
            sub={
              r.status === "hidden" ? (
                <span className="inline-flex items-center gap-1">
                  <EyeOff className="size-3" aria-hidden />“{r.comment}”
                </span>
              ) : (
                `“${r.status === "redacted" && r.redactedComment ? r.redactedComment : r.comment}”`
              )
            }
          />
        </div>
      ),
    },
    {
      id: "rating",
      header: t("columns.rating"),
      sortable: true,
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-13 font-medium text-ink tabular-nums">
          <Star className="size-4 text-gold" aria-hidden />
          {r.rating.toFixed(1)}
        </span>
      ),
    },
    {
      id: "service",
      header: t("columns.service"),
      cell: (r) => (
        <LinkCell
          href={
            r.service
              ? `/services/${r.service.id}`
              : r.pack
                ? `/packs/${r.pack.id}`
                : `/users/${r.provider.id}`
          }
          label={offerTitle(r, locale)}
          sub={r.provider.businessName ?? r.provider.fullName}
        />
      ),
    },
    {
      id: "booking",
      header: t("columns.booking"),
      cell: (r) => <LinkCell href={`/bookings/${r.booking.id}`} label={`#${r.booking.reference}`} />,
    },
    {
      id: "createdAt",
      header: t("columns.date"),
      sortable: true,
      cell: (r) => (
        <span className="text-13 whitespace-nowrap text-ink-2">{formatDate(r.createdAt, locale)}</span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <ReviewStatusPill status={r.status} reportsOpen={r.reportsOpen} />
          {r.detectedFlags.length > 0 && (
            <Pill tone="amber" dot={false}>
              <Flag className="size-3" aria-hidden />
              {r.detectedFlags.map((f) => t(`flags.${f}`)).join(", ")}
            </Pill>
          )}
          {r.hadDispute && (
            <Pill tone="gray" dot={false}>
              {t("hadDispute")}
            </Pill>
          )}
        </span>
      ),
    },
  ];

  async function quickModerate(r: ReviewRow, action: "hide" | "show") {
    try {
      await moderateReview(r.id, { action });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      toast.success(t(`drawer.done.${action}`), {
        action: {
          label: t("undo"),
          onClick: () =>
            void moderateReview(r.id, {
              action: action === "hide" ? "show" : "hide",
              notifyAuthor: false,
            }).then(() => void queryClient.invalidateQueries({ queryKey: reviewKeys.all }), toast.apiError),
        },
      });
    } catch (e) {
      toast.apiError(e);
    }
  }

  const rowMenu = (r: ReviewRow): ActionMenuItem[][] => [
    [
      { icon: <Eye />, label: t("menu.open"), onSelect: () => void setReviewId(r.id) },
      { icon: <CalendarDays />, label: t("menu.openBooking"), href: `/bookings/${r.booking.id}` },
      { icon: <User />, label: t("menu.openAuthor"), href: `/users/${r.author.id}` },
    ],
    [
      r.status === "hidden"
        ? { icon: <Eye />, label: t("menu.show"), onSelect: () => void quickModerate(r, "show") }
        : { icon: <EyeOff />, label: t("menu.hide"), onSelect: () => void quickModerate(r, "hide") },
      {
        icon: <XCircle />,
        label: t("menu.dismiss"),
        disabled: r.reportsOpen === 0,
        onSelect: () => setDismissing(r),
      },
    ],
    [{ icon: <Trash2 />, label: t("menu.delete"), danger: true, onSelect: () => setDeleting(r) }],
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("manage") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        actions={
          <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
            {t("export")}
          </Button>
        }
      />
      <div className="mb-4 max-w-[360px]">
        <SegmentedControl
          aria-label={t("view")}
          value={reportsView ? "reports" : "reviews"}
          onValueChange={(val) => {
            // Each view has its own tabs and filters.
            router.replace(val === "reports" ? "/reviews?view=reports" : "/reviews");
          }}
          options={[
            { value: "reviews", label: t("views.reviews") },
            {
              value: "reports",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {t("views.reports")}
                  {counts?.reported ? (
                    <span className="rounded-pill bg-red-soft px-1.5 text-11 text-red tabular-nums">
                      {counts.reported}
                    </span>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </div>

      {reportsView ? (
        <ReportsList
          onOpenReview={(id) => void setReviewId(id)}
          exportOpen={exportOpen}
          onExportOpenChange={setExportOpen}
        />
      ) : (
        <>
          <DataList<ReviewRow>
            resource={reviewKeys.all}
            queryFn={(p) => listReviews(reviewsQuery({ ...p, tab: (p.filters.status as string) || p.tab }))}
            columns={columns}
            getRowId={(r) => r.id}
            tabs={TAB_OPTIONS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
            tabCounts={(res) => (res as ReviewList).meta.counts as unknown as Record<string, number>}
            defaultTab="all"
            filters={filters}
            advancedFilters={advancedFilters}
            quickFilters={quickFilters}
            sortOptions={[
              { value: "createdAt:desc", label: t("sort.newest") },
              { value: "createdAt:asc", label: t("sort.oldest") },
              { value: "rating:asc", label: t("sort.lowest") },
              { value: "rating:desc", label: t("sort.highest") },
            ]}
            searchPlaceholder={t("searchPlaceholder")}
            savedViews={savedViewsSource("reviews")}
            columnsStorageKey="reviews"
            itemLabel={t("itemLabel")}
            onParamsChange={setParams}
            onRowClick={(r) => void setReviewId(r.id)}
            rowProps={(r) => ({ className: r.reportsOpen > 0 ? "bg-red-soft/30" : undefined })}
            rowMenuHeader={(r) => ({
              title: r.author.fullName,
              subtitle: `★ ${r.rating.toFixed(1)} · #${r.booking.reference}`,
            })}
            rowMenu={rowMenu}
            emptyState={
              <EmptyState
                icon={<MessageSquareOff />}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            }
          />
          <ExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            resource="reviews"
            title={t("exportTitle")}
            filters={params ? exportFilters(params) : {}}
            summary={t("exportSummary", {
              count: formatNumber(stats.data?.meta.total ?? 0, locale),
              tab: t(`tabs.${(params?.tab as (typeof TAB_OPTIONS)[number]) || "all"}`),
            })}
            columns={[
              { key: "author", label: t("exportColumns.author") },
              { key: "rating", label: t("columns.rating") },
              { key: "comment", label: t("exportColumns.comment") },
              { key: "service", label: t("columns.service") },
              { key: "provider", label: t("exportColumns.provider") },
              { key: "booking", label: t("columns.booking") },
              { key: "status", label: t("columns.status") },
              { key: "createdAt", label: t("columns.date") },
            ]}
          />
        </>
      )}

      <ReviewDrawer id={reviewId} onClose={() => void setReviewId(null)} />
      <DeleteReviewDialog
        review={deleting}
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onHideInstead={
          deleting && deleting.status !== "hidden" ? () => void quickModerate(deleting, "hide") : undefined
        }
      />
      <DismissReviewReportsDialog review={dismissing} onClose={() => setDismissing(null)} />
    </>
  );
}

/** REV-01 ⋯ Dismiss report: keeps the review, dismisses its open reports. */
function DismissReviewReportsDialog({ review, onClose }: { review: ReviewRow | null; onClose: () => void }) {
  const t = useTranslations("reviews.dismissAll");
  const queryClient = useQueryClient();
  return (
    <ConfirmDialog
      open={!!review}
      onOpenChange={(o) => !o && onClose()}
      icon={<XCircle />}
      title={t("title")}
      description={review ? t("description", { count: review.reportsOpen }) : ""}
      messageField={{ label: t("note"), placeholder: t("placeholder") }}
      confirmLabel={t("confirm")}
      onConfirm={async (v) => {
        if (!review) return;
        await moderateReview(review.id, { action: "dismiss_reports", note: v.message.trim() || undefined });
        toast.success(t("done"));
        void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      }}
    />
  );
}

function exportFilters(p: ListParams): Record<string, unknown> {
  const q = reviewsQuery({ ...p, tab: (p.filters.status as string) || p.tab });
  delete q.page;
  delete q.limit;
  delete q.sort;
  return Object.fromEntries(
    Object.entries(q).filter(([, val]) => val !== undefined && !(Array.isArray(val) && val.length === 0)),
  );
}
