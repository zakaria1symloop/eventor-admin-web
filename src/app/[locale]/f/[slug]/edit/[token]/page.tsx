import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditRequestScreen } from "../../../public-form-screens";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "publicForm" });
  return { title: t("editTitle") };
}

/** `/f/:slug/edit/:token` (same screen as the `?token=` link). */
export default async function EditRequestTokenPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}) {
  const { locale, slug, token } = await params;
  setRequestLocale(locale);
  return <EditRequestScreen slug={slug} token={decodeURIComponent(token)} />;
}
