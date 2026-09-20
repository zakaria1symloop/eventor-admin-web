import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReviewScreen } from "./review-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "verifications.review" });
  return { title: t("metaTitle") };
}

export default async function Page({ params }: { params: Promise<{ locale: string; userId: string }> }) {
  const { locale, userId } = await params;
  setRequestLocale(locale);
  return <ReviewScreen userId={userId} />;
}
