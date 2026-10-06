"use client";

import { ReviewsCard } from "../../reviews/reviews-card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
  Camera,
  ChevronRight,
  Construction,
  Eye,
  EyeOff,
  Layers,
  MapPin,
  MessageCircle,
  Pencil,
  SearchX,
  Smartphone,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import {
  CardLinkRow,
  DetailHeader,
  LinkedCounts,
  TwoColumn,
  type LinkedCount,
} from "@/components/layout/detail";
import { PageHeader } from "@/components/layout/page-header";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValueList } from "@/components/ui/key-value-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { getService, localTitle, serviceKeys, type ServiceDetail } from "@/lib/api/services";
import { formatCompactMoney, formatDate, formatDateTime, formatMoney, formatNumber, initials } from "@/lib/utils/format";
import { localName } from "../../users/use-user-options";
import { PhotoGallery } from "../photo-gallery";
import { DeleteServiceDialog, HideServiceDialog, showServices, toggleFeatured } from "../service-dialogs";
import { ServiceStatusCell } from "../services-screen";
import { AvailabilityCalendar } from "./availability-calendar";

export function useService(id: string | null) {
  return useQuery({ queryKey: serviceKeys.detail(id ?? ""), queryFn: () => getService(id!), enabled: !!id });
}

export function ServiceDetailScreen({ id }: { id: string }) {
  const t = useTranslations("services");
  const td = useTranslations("services.detail");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useService(id);
  const [overlay, setOverlay] = useState<"hide" | "delete" | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: serviceKeys.all });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <CardSkeleton className="h-[160px]" />
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
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/services" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={td("notFoundTitle")}
              description={td("notFoundDescription")}
              actions={[
                <Button key="back" variant="secondary" onClick={() => router.push("/services")}>
                  {td("backToServices")}
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

  const s = query.data;
  const title = localTitle(s, locale);
  const target = { id: s.id, title, providerName: s.provider.businessName ?? s.provider.fullName };
  const st = s.stats;

  const counts: LinkedCount[] = [
    {
      label: td("counts.bookings"),
      value: formatNumber(st.bookings.total, locale),
      hint: td("counts.bookingsHint", { pending: st.bookings.pending, accepted: st.bookings.accepted }),
      href: `/bookings?service=${s.id}`,
    },
    {
      label: td("counts.revenue"),
      value: formatCompactMoney(st.revenue, locale),
      hint: td("counts.revenueHint"),
    },
    {
      label: td("counts.rating"),
      value: s.ratingCount ? s.rating.toFixed(1) : "—",
      hint: td("counts.ratingHint", { count: s.ratingCount }),
      href: `/reviews?service=${s.id}`,
    },
    {
      label: td("counts.packs"),
      value: formatNumber(st.packsCount, locale),
      hint:
        st.packs.map((p) => localName({ nameEn: p.nameEn, nameAr: p.nameAr }, locale)).join(", ") ||
        td("counts.noPacks"),
      href: st.packsCount ? `/services/${s.id}?tab=packs` : undefined,
    },
    {
      label: td("counts.favourites"),
      value: formatNumber(s.favouritesCount, locale),
      hint: td("counts.favouritesHint"),
    },
    {
      label: td("counts.photos"),
      value: formatNumber(s.photos.length, locale),
      hint: s.isFeatured
        ? td("counts.featured", { position: s.featuredPosition ?? "—" })
        : td("counts.photosHint"),
    },
  ];

  return (
    <>
      <PageHeader
        back
        breadcrumb={[
          { label: t("title"), href: "/services" },
          { label: localName(s.category, locale), href: `/services?categoryId=${s.category.id}` },
          { label: title },
        ]}
        className="mb-4"
      />

      {s.hidden && (
        <Banner
          tone="amber"
          icon={<EyeOff />}
          className="mb-4"
          title={td("hiddenBanner", {
            reason: t.has(`hide.reasons.${s.hidden.reason}`)
              ? t(`hide.reasons.${s.hidden.reason}`)
              : s.hidden.reason,
          })}
          description={[
            s.hidden.hiddenBy && s.hidden.hiddenAt
              ? td("hiddenBy", {
                  name: s.hidden.hiddenBy.fullName,
                  date: formatDateTime(s.hidden.hiddenAt, locale),
                })
              : null,
            s.hidden.message,
            s.hidden.allowResubmit ? td("resubmitAllowed") : td("resubmitNotAllowed"),
          ]
            .filter(Boolean)
            .join(" · ")}
          action={
            <Button
              variant="secondary"
              icon={<Eye />}
              onClick={() => void showServices([target], t, () => void invalidate())}
            >
              {t("menu.show")}
            </Button>
          }
        />
      )}

      <DetailHeader
        variant="plain"
        icon={
          s.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.coverUrl} alt="" className="size-14 rounded-xl object-cover" />
          ) : (
            <Camera />
          )
        }
        title={title}
        badges={[
          <ServiceStatusCell key="status" s={s} />,
          ...(s.isFeatured
            ? [
                <Pill key="featured" tone="gold">
                  {t("featuredLabel")}
                </Pill>,
              ]
            : []),
        ]}
        meta={[
          {
            label: (
              <>
                {td("by")}{" "}
                <Link href={`/users/${s.provider.id}`} className="font-medium text-brand hover:underline">
                  {[s.provider.fullName, s.provider.businessName].filter(Boolean).join(" · ")}
                </Link>
              </>
            ),
          },
          { icon: <Tag />, label: localName(s.category, locale) },
          { icon: <MapPin />, label: s.wilayas.map((w) => localName(w, locale)).join(", ") || "—" },
          { label: <span className="font-mono text-12">ID {s.id.slice(0, 8)}</span> },
        ]}
        actions={
          <>
            <Button variant="secondary" icon={<Smartphone />} disabled title={t("soon")}>
              {td("viewInApp")}
            </Button>
            {s.status === "hidden" ? (
              <Button
                variant="secondary"
                icon={<Eye />}
                onClick={() => void showServices([target], t, () => void invalidate())}
              >
                {t("menu.show")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<EyeOff />}
                disabled={s.status !== "published"}
                onClick={() => setOverlay("hide")}
              >
                {td("hide")}
              </Button>
            )}
            <Button icon={<Pencil />} onClick={() => router.push(`/services/${s.id}/edit`)}>
              {td("edit")}
            </Button>
          </>
        }
        moreMenu={[
          [
            {
              icon: <Star />,
              label: s.isFeatured ? t("menu.unfeature") : t("menu.feature"),
              disabled: s.status !== "published" && !s.isFeatured,
              onSelect: () =>
                void toggleFeatured({ ...target, isFeatured: s.isFeatured }, t, () => void invalidate()),
            },
            { icon: <Layers />, label: td("addToPack"), href: `/packs/new?provider=${s.provider.id}` },
          ],
          [{ icon: <Trash2 />, label: t("menu.delete"), danger: true, onSelect: () => setOverlay("delete") }],
        ]}
      >
        <LinkedCounts items={counts} />
      </DetailHeader>

      <DetailTabs service={s} onOverlay={setOverlay} />

      <HideServiceDialog
        services={[target]}
        open={overlay === "hide"}
        onOpenChange={(o) => !o && setOverlay(null)}
        pendingBookings={st.bookings.pending}
        onDone={() => void invalidate()}
      />
      <DeleteServiceDialog
        service={target}
        open={overlay === "delete"}
        onOpenChange={(o) => !o && setOverlay(null)}
        impact={{
          pendingBookings: st.bookings.pending,
          upcomingBookings: st.bookings.accepted,
          packs: st.packs.map((p) => localName({ nameEn: p.nameEn, nameAr: p.nameAr }, locale)),
          reviews: s.ratingCount,
        }}
        onHideInstead={s.status === "published" ? () => setOverlay("hide") : undefined}
        onDeleted={() => {
          void invalidate();
          router.push("/services");
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ tabs */

function DetailTabs({
  service: s,
  onOverlay,
}: {
  service: ServiceDetail;
  onOverlay: (o: "hide" | "delete") => void;
}) {
  const td = useTranslations("services.detail");
  const locale = useLocale();
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("details").withOptions({ history: "replace" }),
  );
  const items = [
    { key: "details", label: td("tabs.details") },
    { key: "availability", label: td("tabs.availability") },
    { key: "bookings", label: td("tabs.bookings"), count: s.stats.bookings.total },
    { key: "reviews", label: td("tabs.reviews"), count: s.ratingCount },
    { key: "packs", label: td("tabs.packs"), count: s.stats.packsCount },
    { key: "activity", label: td("tabs.activity") },
  ];
  const current = items.some((i) => i.key === tab) ? tab : "details";
  const soon: Record<string, { module: number; href: string; label: string }> = {
    bookings: { module: 8, href: `/bookings?service=${s.id}`, label: td("openBookings") },
    activity: { module: 2, href: `/activity-log?objectId=${s.id}`, label: td("openActivityLog") },
  };

  return (
    <>
      <Tabs
        items={items}
        value={current}
        onChange={(k) => void setTab(k === "details" ? null : k)}
        className="mb-4 [&>[role=tablist]]:px-1"
        aria-label={td("tabsLabel")}
      />
      {current === "details" && <Details service={s} onOverlay={onOverlay} />}
      {current === "availability" && (
        <Card>
          <CardBody>
            <AvailabilityCalendar providerId={s.provider.id} service={s} />
          </CardBody>
        </Card>
      )}
      {current === "packs" && (
        <Card>
          <CardHeader title={td("packsTitle")} />
          {s.stats.packs.length === 0 ? (
            <EmptyState icon={<Layers />} title={td("noPacks")} description={td("noPacksHint")} />
          ) : (
            <ul className="divide-y divide-border">
              {s.stats.packs.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/packs/${p.id}`}
                    className="flex items-center gap-3 px-[18px] py-3 hover:bg-canvas"
                  >
                    <Layers className="size-4 text-brand" aria-hidden />
                    <span className="flex-1 text-14 font-medium text-brand">
                      {localName({ nameEn: p.nameEn, nameAr: p.nameAr }, locale)}
                    </span>
                    {p.needsAttention && <StatusBadge domain="pack" status="needs_attention" />}
                    <StatusBadge domain="pack" status={p.status} />
                    <ChevronRight className="flip-rtl size-4 text-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {current === "reviews" && <ReviewsCard scope={{ serviceId: s.id }} />}
      {soon[current] && (
        <Card>
          <EmptyState
            icon={<Construction />}
            title={td("comingSoonTitle")}
            description={td("comingSoonDescription", { module: soon[current].module })}
            actions={[
              <Link
                key="l"
                href={soon[current].href}
                className="text-13 font-medium text-brand hover:underline"
              >
                {soon[current].label}
              </Link>,
            ]}
          />
        </Card>
      )}
    </>
  );
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:underline">
      {children}
      <ChevronRight className="flip-rtl size-4" aria-hidden />
    </Link>
  );
}

function LangBlock({
  lang,
  title,
  body,
}: {
  lang: "en" | "ar";
  title?: string | null;
  body?: string | null;
}) {
  const td = useTranslations("services.detail");
  const ar = lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"} lang={lang} className={ar ? "font-arabic" : undefined}>
      <Pill tone="gray" className="mb-2">
        {ar ? "العربية" : "English"}
      </Pill>
      {title !== undefined && (
        <h3 className="text-16 font-semibold text-ink">
          {title || <span className="text-red">{td("missing")}</span>}
        </h3>
      )}
      <p className="mt-1.5 text-13 leading-relaxed whitespace-pre-line text-ink-2">
        {body || <span className="text-red">{td("missing")}</span>}
      </p>
    </div>
  );
}

function Details({
  service: s,
  onOverlay,
}: {
  service: ServiceDetail;
  onOverlay: (o: "hide" | "delete") => void;
}) {
  const t = useTranslations("services");
  const td = useTranslations("services.detail");
  const tw = useTranslations("weeklyHours");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: serviceKeys.all });
  const editHref = `/services/${s.id}/edit`;
  const hoursSummary =
    s.hours.length === 0
      ? td("anyTime")
      : [1, 2, 3, 4, 5, 6, 7]
          .filter((d) => s.hours.some((h) => h.weekday === d))
          .map((d) => `${tw(`days.${d}`)} ${s.hours.filter((h) => h.weekday === d).map((h) => `${h.startTime}–${h.endTime}`).join(", ")}`)
          .join(" · ");
  const period =
    !s.availableFrom && !s.availableUntil
      ? td("noLimit")
      : `${s.availableFrom ? formatDate(s.availableFrom, locale) : "…"} – ${s.availableUntil ? formatDate(s.availableUntil, locale) : "…"}`;
  const bothFilled = !!(s.titleEn && s.titleAr && s.descriptionEn && s.descriptionAr);
  const target = { id: s.id, title: localTitle(s, locale), isFeatured: s.isFeatured };
  const pc = s.providerCard;

  const main = (
    <>
      <Card>
        <CardHeader
          title={td("content")}
          titleAddon={
            <Pill tone={bothFilled ? "green" : "amber"}>
              {bothFilled ? td("bothFilled") : td("translationMissing")}
            </Pill>
          }
          action={<SectionLink href={editHref}>{td("editShort")}</SectionLink>}
        />
        <div className="grid md:grid-cols-2 md:divide-x md:divide-border rtl:md:divide-x-reverse">
          <div className="px-[18px] py-4">
            <LangBlock lang="en" title={s.titleEn} body={s.descriptionEn} />
          </div>
          <div className="border-t border-border px-[18px] py-4 md:border-t-0">
            <LangBlock lang="ar" title={s.titleAr} body={s.descriptionAr} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={td("photos", { count: s.photos.length })}
          action={<SectionLink href={`${editHref}#photos`}>{td("managePhotos")}</SectionLink>}
        />
        <CardBody>
          <PhotoGallery photos={s.photos} title={localTitle(s, locale)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={td("priceOptions")}
          action={<SectionLink href={editHref}>{td("editShort")}</SectionLink>}
        />
        <div className="grid gap-x-8 px-[18px] py-2 md:grid-cols-2">
          <KeyValueList
            rows={[
              {
                label: td("basePrice"),
                value: (
                  <span className="font-semibold" dir="ltr">
                    {formatMoney(s.basePrice, locale)} · {t(`priceTypesShort.${s.priceType}`)}
                  </span>
                ),
              },
              { label: td("deposit"), value: td("depositNone") },
              { label: td("maxEventsPerDay"), value: s.maxEventsPerDay },
              { label: td("maxGuests"), value: s.maxGuests ?? "—" },
              { label: td("concurrentClients"), value: s.concurrentClients },
              { label: td("availablePeriod"), value: period },
              { label: td("hours"), value: hoursSummary },
            ]}
          />
          <div className="border-border max-md:border-t">
            {s.extras.length === 0 ? (
              <p className="py-2 text-13 text-muted">{td("noExtras")}</p>
            ) : (
              <KeyValueList
                rows={s.extras.map((x) => ({
                  label: localName({ nameEn: x.nameEn, nameAr: x.nameAr }, locale),
                  value: <span dir="ltr">+ {formatMoney(x.price, locale)}</span>,
                }))}
              />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={td("facts")}
          action={<SectionLink href={editHref}>{td("editShort")}</SectionLink>}
        />
        {s.facts.length === 0 ? (
          <p className="px-[18px] py-4 text-13 text-muted">{td("noFacts")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {s.facts.map((f, i) => (
              <li key={i} className="grid grid-cols-2 gap-4 px-[18px] py-2.5 text-13">
                <span>
                  <span className="text-muted">{f.label_en}</span> ·{" "}
                  <span className="text-ink">{f.value_en}</span>
                </span>
                <span dir="rtl" lang="ar" className="font-arabic">
                  <span className="text-muted">{f.label_ar}</span> ·{" "}
                  <span className="text-ink">{f.value_ar}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={td("cancellationPolicy")}
          subtitle={td("cancellationHint")}
          action={<SectionLink href={editHref}>{td("editShort")}</SectionLink>}
        />
        <div className="grid md:grid-cols-2 md:divide-x md:divide-border rtl:md:divide-x-reverse">
          <div className="px-[18px] py-4">
            <LangBlock lang="en" body={s.cancellationPolicyEn} />
          </div>
          <div className="border-t border-border px-[18px] py-4 md:border-t-0">
            <LangBlock lang="ar" body={s.cancellationPolicyAr} />
          </div>
        </div>
      </Card>
    </>
  );

  const aside = (
    <>
      <Card>
        <CardHeader
          title={td("provider")}
          action={<SectionLink href={`/users/${pc.id}`}>{td("openProfile")}</SectionLink>}
        />
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-13 font-semibold text-brand">
              {initials(pc.fullName)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex flex-wrap items-center gap-1.5">
                <Link href={`/users/${pc.id}`} className="text-14 font-medium text-brand hover:underline">
                  {pc.fullName}
                </Link>
                <StatusBadge
                  domain="document"
                  status={pc.verificationStatus === "pending" ? "in_review" : pc.verificationStatus}
                />
                {pc.status === "blocked" && <StatusBadge domain="user" status="blocked" />}
              </span>
              <span className="block truncate text-12 text-muted">
                {[pc.businessName, pc.ratingCount ? `${pc.rating.toFixed(1)} ★ (${pc.ratingCount})` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </div>
          {!pc.acceptingBookings && <p className="text-12 text-amber">{td("notAccepting")}</p>}
          <div className="overflow-hidden rounded-lg border border-border [&>a]:border-border [&>a:not(:last-child)]:border-b">
            <CardLinkRow
              href={`/services?provider=${pc.id}`}
              icon={<Briefcase />}
              label={td("allServices")}
              count={pc.servicesCount}
            />
            <CardLinkRow
              href={`/packs?provider=${pc.id}`}
              icon={<Layers />}
              label={td("allPacks")}
              count={pc.packsCount}
            />
            <CardLinkRow
              href={`/bookings?provider=${pc.id}`}
              icon={<CalendarDays />}
              label={td("allBookings")}
              count={pc.bookingsCount}
            />
            <CardLinkRow
              href={`/reviews?provider=${pc.id}`}
              icon={<Star />}
              label={td("allReviews")}
              count={pc.ratingCount}
            />
            <CardLinkRow
              href={`/messages?user=${pc.id}`}
              icon={<MessageCircle />}
              label={td("conversations")}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <AvailabilityCalendar
            providerId={s.provider.id}
            service={s}
            compact
            fullHref={`/services/${s.id}?tab=availability`}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={td("moderation")} />
        <CardBody className="flex flex-col gap-3 py-2">
          <KeyValueList
            rows={[
              { label: td("shownInApp"), value: s.visibleInApp ? td("yes") : td("no") },
              {
                label: td("featuredOnHome"),
                value: s.isFeatured ? `#${s.featuredPosition ?? "—"}` : td("no"),
              },
              {
                label: td("wilayas"),
                value:
                  s.wilayaDetails
                    .map((w) => `${localName(w, locale)}${w.isOpen ? "" : ` (${td("closed")})`}`)
                    .join(", ") || "—",
              },
              { label: td("lastEdited"), value: formatDateTime(s.updatedAt, locale) },
            ]}
          />
          {s.visibilityReasons.length > 0 && (
            <Banner
              tone="amber"
              title={td("notVisibleBecause")}
              description={
                <ul className="list-inside list-disc">
                  {s.visibilityReasons.map((r) => (
                    <li key={r}>{td(`visibility.${r}`)}</li>
                  ))}
                </ul>
              }
            />
          )}
          {s.publishMissing.length > 0 && (
            <Banner
              tone="blue"
              title={td("publishMissing")}
              description={s.publishMissing.map((m) => t(`publishFields.${m}`)).join(", ")}
            />
          )}
          <div className="flex flex-wrap gap-2 pb-2">
            <Button
              variant="secondary"
              icon={<Star />}
              disabled={s.status !== "published" && !s.isFeatured}
              onClick={() => void toggleFeatured(target, t, () => void invalidate())}
            >
              {s.isFeatured ? t("menu.unfeature") : t("menu.feature")}
            </Button>
            {s.status === "published" && (
              <Button variant="secondary" icon={<EyeOff />} onClick={() => onOverlay("hide")}>
                {td("hide")}
              </Button>
            )}
            <Button variant="secondary" icon={<Trash2 />} onClick={() => onOverlay("delete")}>
              {td("deleteShort")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );

  return <TwoColumn main={main} aside={aside} />;
}
