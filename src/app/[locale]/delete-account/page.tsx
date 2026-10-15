import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteAccountScreen } from "./delete-account-screen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deleteAccount" });
  return { title: t("title") };
}

/** Public "Delete my account" page (Google Play Data safety). No AppShell, no auth. */
export default async function DeleteAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DeleteAccountScreen />;
}
