import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditPackScreen } from "../../pack-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "packs.form" });
  return { title: t("editTitle") };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <EditPackScreen id={id} />;
}
