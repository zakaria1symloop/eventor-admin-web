import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, AuthTitle } from "@/components/layout/auth-layout";
import { ForgotPasswordForm } from "./forgot-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "forgot" });
  return { title: t("title") };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forgot");
  return (
    <AuthLayout>
      <AuthTitle title={t("title")} subtitle={t("subtitle")} backToLogin />
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
