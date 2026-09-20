import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsScreen } from "./settings-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.settings" });
  return { title: t("title") };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: t("breadcrumb.setup") }, { label: t("pages.settings.title") }]}
        title={t("pages.settings.title")}
        subtitle={t("settings.subtitle")}
      />
      <SettingsScreen />
    </>
  );
}
