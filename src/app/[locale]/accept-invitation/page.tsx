import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, AuthTitle } from "@/components/layout/auth-layout";
import { AcceptInvitationForm } from "./accept-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "invitation" });
  return { title: t("title") };
}

export default async function AcceptInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("invitation");
  return (
    <AuthLayout>
      <AuthTitle title={t("title")} subtitle={t("subtitle")} withLanguage />
      <AcceptInvitationForm token={token ?? ""} />
    </AuthLayout>
  );
}
