import { Construction } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/states";
import { PageHeader } from "./page-header";

type PageKey =
  | "overview"
  | "users"
  | "verifications"
  | "services"
  | "packs"
  | "bookings"
  | "disputes"
  | "academicRequests"
  | "reviews"
  | "messages"
  | "categories"
  | "locations"
  | "settings"
  | "activityLog"
  | "account";

const groupOf: Partial<Record<PageKey, "manage" | "setup">> = {
  users: "manage",
  verifications: "manage",
  services: "manage",
  packs: "manage",
  bookings: "manage",
  disputes: "manage",
  academicRequests: "manage",
  reviews: "manage",
  messages: "manage",
  categories: "setup",
  locations: "setup",
  settings: "setup",
  activityLog: "setup",
};

/** Placeholder for a sidebar route whose screens ship in a later module. */
export async function ComingSoonPage({
  params,
  page,
  module,
}: {
  params: Promise<{ locale: string }>;
  page: PageKey;
  module: number;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const group = groupOf[page];

  return (
    <>
      <PageHeader
        breadcrumb={
          group ? [{ label: t(`breadcrumb.${group}`) }, { label: t(`pages.${page}.title`) }] : undefined
        }
        title={t(`pages.${page}.title`)}
        subtitle={t(`pages.${page}.subtitle`)}
      />
      <Card>
        <EmptyState
          icon={<Construction />}
          title={t("comingSoon.title", { module })}
          description={t("comingSoon.description", { module })}
        />
      </Card>
    </>
  );
}
