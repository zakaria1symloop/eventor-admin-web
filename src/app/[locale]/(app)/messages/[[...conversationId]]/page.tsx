import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InboxScreen } from "../inbox-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.messages" });
  return { title: t("title") };
}

/** `/messages` (MSG-01 inbox) and `/messages/:conversationId` share one screen so the list stays mounted. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; conversationId?: string[] }>;
}) {
  const { locale, conversationId } = await params;
  setRequestLocale(locale);
  return <InboxScreen conversationId={conversationId?.[0]} />;
}
