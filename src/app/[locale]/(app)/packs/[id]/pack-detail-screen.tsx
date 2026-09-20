"use client";

import { ReviewsCard } from "../../reviews/reviews-card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  EyeOff,
  Layers,
  MapPin,
  Pencil,
  SearchX,
  Send,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { CardLinkRow, DetailHeader, TwoColumn } from "@/components/layout/detail";
import { PageHeader } from "@/components/layout/page-header";
import { Pill, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValueList } from "@/components/ui/key-value-list";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  getPack,
  localPackName,
  PACK_PUBLISH_FIELDS,
  packKeys,
  type PackDetail,
  type PackItem,
} from "@/lib/api/packs";
import { localTitle } from "@/lib/api/services";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatMoney, formatNumber, initials } from "@/lib/utils/format";
import { PhotoGallery } from "../../services/photo-gallery";
import { localName } from "../../users/use-user-options";
import {
  DeletePacksDialog,
  duplicatePack,
  PackStatusCell,
  publishPack,
  UnpublishPacksDialog,
} from "../packs-screen";

const availabilityTone: Record<PackItem["availability"], Tone> = {
  available: "green",
  not_published: "amber",
  hidden: "red",
  deleted: "red",
};

export function PackDetailScreen({ id }: { id: string }) {
  const t = useTranslations("packs");
  const td = useTranslations("packs.detail");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: packKeys.detail(id), queryFn: () => getPack(id) });
  const [overlay, setOverlay] = useState<"delete" | "unpublish" | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: packKeys.all });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <CardSkeleton className="h-[100px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
          <CardSkeleton className="h-[360px]" />
          <CardSkeleton className="h-[240px]" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/packs" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={td("notFoundTitle")}
              description={td("notFoundDescription")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/packs")}>
                  {td("backToPacks")}
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

  const p = query.data;
  const name = localPackName(p, locale);
  const target = { id: p.id, name, bookingsCount: p.bookingsCount };
  const providerName = p.provider.businessName ?? p.provider.fullName;

  return (
    <>
      <PageHeader
        back
        breadcrumb={[{ label: t("title"), href: "/packs" }, { label: name }]}
        className="mb-4"
      />

      {(p.needsAttention || p.attentionReasons.length > 0) && (
        <Banner
          tone="red"
          icon={<AlertTriangle />}
          className="mb-4"
          title={td("attentionTitle")}
          description={
            <ul className="list-inside list-disc">
              {p.attentionReasons.map((r, i) => {
                const item = r.serviceId ? p.items.find((it) => it.service.id === r.serviceId) : null;
                return (
                  <li key={i}>
                    {td(`attention.${r.code}`, { service: item ? localTitle(item.service, locale) : "" })}
                  </li>
                );
              })}
            </ul>
          }
          action={
            <Button variant="secondary" icon={<Pencil />} onClick={() => router.push(`/packs/${p.id}/edit`)}>
              {td("fixItems")}
            </Button>
          }
        />
      )}

      <DetailHeader
        variant="plain"
        icon={
          p.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.coverUrl} alt="" className="size-14 rounded-xl object-cover" />
          ) : (
            <Layers />
          )
        }
        title={name}
        badges={[<PackStatusCell key="s" p={p} />]}
        meta={[
          {
            label: (
              <>
                {td("by")}{" "}
                <Link href={`/users/${p.provider.id}`} className="font-medium text-brand hover:underline">
                  {providerName}
                  {p.provider.businessName ? ` (${p.provider.fullName})` : ""}
                </Link>
              </>
            ),
          },
          { icon: <CalendarDays />, label: t(`eventTypes.${p.eventType}`) },
          { icon: <MapPin />, label: localName(p.wilaya, locale) },
          { icon: <Briefcase />, label: t("servicesCount", { count: p.itemsCount }) },
        ]}
        actions={
          <>
            <Button variant="secondary" icon={<Smartphone />} disabled title={t("soon")}>
              {td("viewInApp")}
            </Button>
            {p.status === "published" ? (
              <Button variant="secondary" icon={<EyeOff />} onClick={() => setOverlay("unpublish")}>
                {t("menu.unpublish")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<Send />}
                onClick={() => void publishPack(target, t, () => void invalidate())}
              >
                {t("menu.publish")}
              </Button>
            )}
            <Button icon={<Pencil />} onClick={() => router.push(`/packs/${p.id}/edit`)}>
              {td("edit")}
            </Button>
          </>
        }
        moreMenu={[
          [
            {
              icon: <Copy />,
              label: t("menu.duplicate"),
              onSelect: () =>
                void duplicatePack(target, t, (copyId) => {
                  void invalidate();
                  router.push(`/packs/${copyId}/edit`);
                }),
            },
          ],
          [{ icon: <Trash2 />, label: t("menu.delete"), danger: true, onSelect: () => setOverlay("delete") }],
        ]}
      />

      <TwoColumn main={<Main pack={p} />} aside={<Aside pack={p} />} />

      <DeletePacksDialog
        packs={overlay === "delete" ? [target] : []}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={() => {
          void invalidate();
          router.push("/packs");
        }}
      />
      <UnpublishPacksDialog
        packs={overlay === "unpublish" ? [target] : []}
        onOpenChange={(o) => !o && setOverlay(null)}
        onDone={() => void invalidate()}
      />
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

function Main({ pack: p }: { pack: PackDetail }) {
  const tsv = useTranslations("services");
  const td = useTranslations("packs.detail");
  const locale = useLocale();
  const savings = Number(p.savings);
  return (
    <>
      <Card>
        <CardHeader
          title={td("items")}
          action={<SectionLink href={`/packs/${p.id}/edit`}>{td("editServices")}</SectionLink>}
        />
        <ul className="divide-y divide-border">
          {p.items.map((it) => (
            <li key={it.service.id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
              {it.service.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.service.coverUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Briefcase className="size-4" aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1 leading-tight">
                <Link
                  href={`/services/${it.service.id}`}
                  className="block truncate text-14 font-medium text-brand hover:underline"
                >
                  {localTitle(it.service, locale)}
                </Link>
                <span className="block truncate text-12 text-muted">
                  {localName(it.service.category, locale)} · {tsv(`priceTypesShort.${it.service.priceType}`)}
                </span>
              </span>
              <Pill tone={availabilityTone[it.availability]}>{td(`availability.${it.availability}`)}</Pill>
              <span className="w-28 text-end text-13 font-semibold text-ink tabular-nums" dir="ltr">
                {formatMoney(it.price, locale)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-border bg-canvas px-[18px] py-3 text-13">
          <div className="flex justify-between">
            <dt className="text-muted">{td("separately")}</dt>
            <dd className="font-medium text-ink tabular-nums" dir="ltr">
              {formatMoney(p.sumOfItems, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-ink">{td("packPrice")}</dt>
            <dd className="font-semibold text-ink tabular-nums" dir="ltr">
              {formatMoney(p.price, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{td("clientSaves")}</dt>
            <dd className={cn("font-medium tabular-nums", savings > 0 ? "text-green" : "text-red")} dir="ltr">
              {formatMoney(p.savings, locale)} ({p.savingsPercent}%)
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title={td("description")} />
        <div className="grid md:grid-cols-2 md:divide-x md:divide-border rtl:md:divide-x-reverse">
          {(["en", "ar"] as const).map((lang) => {
            const body = lang === "en" ? p.descriptionEn : p.descriptionAr;
            const title = lang === "en" ? p.nameEn : p.nameAr;
            return (
              <div
                key={lang}
                dir={lang === "ar" ? "rtl" : "ltr"}
                lang={lang}
                className={cn(
                  "px-[18px] py-4",
                  lang === "ar" && "border-t border-border font-arabic md:border-t-0",
                )}
              >
                <Pill tone="gray" className="mb-2">
                  {lang === "ar" ? "العربية" : "English"}
                </Pill>
                <h3 className="text-15 font-semibold text-ink">
                  {title || <span className="text-red">{td("missing")}</span>}
                </h3>
                <p className="mt-1 text-13 whitespace-pre-line text-ink-2">
                  {body || <span className="text-faint">—</span>}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={td("photos", { count: p.photos.length })}
          action={<SectionLink href={`/packs/${p.id}/edit#photos`}>{td("managePhotos")}</SectionLink>}
        />
        <CardBody>
          <PhotoGallery photos={p.photos} title={localPackName(p, locale)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={td("bookings")}
          action={
            <SectionLink href={`/bookings?pack=${p.id}`}>
              {td("allBookings", { count: p.bookingsCount })}
            </SectionLink>
          }
        />
        <p className="px-[18px] py-6 text-13 text-muted">
          {p.bookingsCount ? td("bookingsSoon") : td("noBookings")}
        </p>
      </Card>

      <ReviewsCard scope={{ packId: p.id }} />
    </>
  );
}

function Aside({ pack: p }: { pack: PackDetail }) {
  const t = useTranslations("packs");
  const td = useTranslations("packs.detail");
  const locale = useLocale();
  const missing = new Set(p.publishMissing);
  return (
    <>
      <Card>
        <CardHeader
          title={td("provider")}
          action={<SectionLink href={`/users/${p.provider.id}`}>{td("openProfile")}</SectionLink>}
        />
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-13 font-semibold text-brand">
              {initials(p.provider.fullName)}
            </span>
            <span className="min-w-0 leading-tight">
              <Link
                href={`/users/${p.provider.id}`}
                className="block truncate text-14 font-medium text-brand hover:underline"
              >
                {[p.provider.fullName, p.provider.businessName].filter(Boolean).join(" · ")}
              </Link>
              <span className="block text-12 text-muted">{td("ownServices")}</span>
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border [&>a]:border-border [&>a:not(:last-child)]:border-b">
            <CardLinkRow
              href={`/services?provider=${p.provider.id}`}
              icon={<Briefcase />}
              label={td("providerServices")}
            />
            <CardLinkRow
              href={`/packs?provider=${p.provider.id}`}
              icon={<Layers />}
              label={td("providerPacks")}
              count={p.stats.total}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={td("numbers")} />
        <CardBody className="py-2">
          <KeyValueList
            rows={[
              { label: td("bookingsCount"), value: formatNumber(p.bookingsCount, locale) },
              {
                label: td("rating"),
                value: p.ratingCount ? `${p.rating.toFixed(1)} (${p.ratingCount})` : t("noReviews"),
              },
              { label: td("maxGuests"), value: p.maxGuests ?? "—" },
              { label: td("visibleInApp"), value: p.visibleInApp ? td("yes") : td("no") },
              {
                label: td("created"),
                value: p.createdBy
                  ? td("createdBy", { date: formatDate(p.createdAt, locale), name: p.createdBy.fullName })
                  : formatDate(p.createdAt, locale),
              },
            ]}
          />
        </CardBody>
      </Card>

      {p.status !== "published" && (
        <Card>
          <CardHeader title={td("beforePublishing")} />
          <CardBody>
            <ul className="flex flex-col gap-1.5 text-13">
              {PACK_PUBLISH_FIELDS.map((f) => (
                <li
                  key={f}
                  className={cn("flex items-center gap-2", missing.has(f) ? "text-red" : "text-ink-2")}
                >
                  {missing.has(f) ? (
                    <X className="size-4" aria-hidden />
                  ) : (
                    <Check className="size-4 text-green" aria-hidden />
                  )}
                  {t(`checklist.${f}`)}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
