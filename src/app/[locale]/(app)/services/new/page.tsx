import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewServiceScreen } from "../service-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services.form" });
  return { title: t("newTitle") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NewServiceScreen />;
}
