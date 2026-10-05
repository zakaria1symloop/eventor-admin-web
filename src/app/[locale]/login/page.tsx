import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, AuthTitle } from "@/components/layout/auth-layout";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("title") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reset?: string; reason?: string }>;
}) {
  const { locale } = await params;
  const { next, reset, reason } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <AuthLayout>
      <AuthTitle title={t("title")} subtitle={t("subtitle")} withLanguage />
      <LoginForm next={next} passwordChanged={reset === "1"} signedInElsewhere={reason === "replaced"} />
    </AuthLayout>
  );
}
