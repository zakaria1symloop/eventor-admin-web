import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, AuthTitle } from "@/components/layout/auth-layout";
import { ResetPasswordForm } from "./reset-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reset" });
  return { title: t("title") };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("reset");
  return (
    <AuthLayout>
      <AuthTitle title={t("title")} subtitle={t("subtitle")} backToLogin />
      <ResetPasswordForm token={token ?? ""} />
    </AuthLayout>
  );
}
