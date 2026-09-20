"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MessageSquareOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Pill } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { listReviews, reviewKeys } from "@/lib/api/reviews";
import { formatDate, initials } from "@/lib/utils/format";
import { ReviewStatusPill, Stars } from "./review-drawer";
import { offerTitle } from "./reviews-screen";

export type ReviewsCardScope =
  { providerId: string } | { authorId: string } | { serviceId: string } | { packId: string };

/** Latest reviews for a profile / service / pack tab; rows open REV-02 over REV-01. */
export function ReviewsCard({ scope, written = false }: { scope: ReviewsCardScope; written?: boolean }) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [key, id] = Object.entries(scope)[0] as [string, string];
  const urlKey = { providerId: "provider", authorId: "author", serviceId: "service", packId: "pack" }[key];
  const listHref = `/reviews?${urlKey}=${id}`;
  const query = useQuery({
    queryKey: [...reviewKeys.all, "card", key, id],
    queryFn: () => listReviews({ [key]: id, limit: 10, sort: "createdAt:desc" }),
  });
  return (
    <Card>
      <CardHeader
        title={written ? t("card.written") : t("card.title")}
        subtitle={query.data ? t("card.total", { count: query.data.meta.total }) : undefined}
        action={
          <Link href={listHref} className="inline-flex items-center gap-1 hover:underline">
            {t("card.openAll")}
            <ChevronRight aria-hidden className="flip-rtl size-3.5" />
          </Link>
        }
      />
      {query.isPending ? (
        <p className="px-[18px] py-6 text-13 text-muted">{t("card.loading")}</p>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState icon={<MessageSquareOff />} title={t("card.empty")} />
      ) : (
        <ul className="divide-y divide-border">
          {query.data.data.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reviews?${urlKey}=${id}&review=${r.id}`}
                className="flex items-start gap-3 px-[18px] py-3 hover:bg-canvas"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-soft text-12 font-semibold text-blue">
                  {initials(written ? (r.provider.businessName ?? r.provider.fullName) : r.author.fullName)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-14 font-medium text-ink">
                      {written ? (r.provider.businessName ?? r.provider.fullName) : r.author.fullName}
                    </span>
                    <Stars rating={r.rating} />
                    <span className="text-12 text-muted">
                      {offerTitle(r, locale)} · {formatDate(r.createdAt, locale)}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-13 text-ink-2">
                    “{r.status === "redacted" && r.redactedComment ? r.redactedComment : r.comment}”
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <ReviewStatusPill status={r.status} reportsOpen={r.reportsOpen} />
                  {r.detectedFlags.length > 0 && (
                    <Pill tone="amber" dot={false}>
                      {r.detectedFlags.map((f) => t(`flags.${f}`)).join(", ")}
                    </Pill>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
