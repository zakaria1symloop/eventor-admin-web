import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, AuthTitle } from "@/components/layout/auth-layout";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "setPassword" });
  // The link carries a single-use token: keep the page out of search engines.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * BUG-L4 — public page behind the e-mailed `${APP_PUBLIC_URL}/set-password?token=…` (an account created
 * from the dashboard, app user). No dashboard login, no dashboard navigation. The path must stay exactly
 * `/set-password` (claimed by the Android app); the locale middleware turns it into `/{en,ar}/set-password`
 * and keeps the query string.
 */
export default async function SetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("setPassword");
  return (
    <AuthLayout panel={t("panel")} tagline={t("tagline")}>
      <AuthTitle title={t("title")} withLanguage />
      <SetPasswordForm token={(Array.isArray(token) ? token[0] : token)?.trim() ?? ""} />
    </AuthLayout>
  );
}
