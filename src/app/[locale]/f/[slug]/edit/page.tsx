import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditRequestScreen } from "../../public-form-screens";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "publicForm" });
  return { title: t("editTitle") };
}

/** Emailed edit link `/f/:slug/edit?token=…` (changes requested). */
export default async function EditRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale, slug } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  return <EditRequestScreen slug={slug} token={token ?? ""} />;
}
