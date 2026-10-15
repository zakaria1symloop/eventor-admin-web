import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalText } from "@/components/domain/legal-text";
import { Link } from "@/i18n/navigation";
import { fetchLegalPage, type LegalDoc } from "@/lib/api/legal";
import { PublicFrame } from "../../f/public-form-screens";

const DOCS: readonly string[] = ["terms", "privacy"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  const t = await getTranslations({ locale, namespace: "legalPage" });
  return { title: DOCS.includes(doc) ? t(`titles.${doc}`) : "Eventor" };
}

/** Public Terms of Use / Privacy Policy (store listings, sign-up, Settings · Help). No AppShell, no auth. */
export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  if (!DOCS.includes(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legalPage" });
  const page = await fetchLegalPage(doc as LegalDoc, locale);
  const link = "font-medium text-brand hover:underline";
  return (
    <PublicFrame wide title={page?.title ?? t(`titles.${doc}`)}>
      {page ? <LegalText body={page.body} /> : <p className="text-14 text-muted">{t("unavailable")}</p>}
      <nav aria-label={t("more")} className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-13">
        <Link href="/legal/terms" className={link}>
          {t("titles.terms")}
        </Link>
        <Link href="/legal/privacy" className={link}>
          {t("titles.privacy")}
        </Link>
        <Link href="/delete-account" className={link}>
          {t("deleteAccount")}
        </Link>
      </nav>
    </PublicFrame>
  );
}
