import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitch } from "./language-switch";

/** SHL-03 / SHL-04 two-panel layout: brand panel + form column. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("auth");
  const ta = useTranslations("app");
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[1fr_1fr] xl:grid-cols-[780px_1fr]">
      <aside className="relative hidden flex-col justify-between bg-brand px-11 py-10 text-white lg:flex">
        <span className="text-22 font-semibold">{ta("name")}</span>
        <div>
          <p className="text-[40px] leading-[48px] font-semibold">{ta("panel")}</p>
          <p className="mt-3 max-w-md text-16 text-white/80">{t("tagline")}</p>
        </div>
        <span className="text-12 text-white/70">{t("copyright", { year: 2026 })}</span>
      </aside>
      <main className="flex min-h-dvh flex-col px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-18 font-semibold text-brand">{ta("name")}</span>
          <LanguageSwitch />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function AuthTitle({
  title,
  subtitle,
  withLanguage,
  backToLogin,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  withLanguage?: boolean;
  backToLogin?: boolean;
}) {
  const t = useTranslations("auth");
  return (
    <div className="mb-5">
      {backToLogin && (
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-13 font-medium text-brand hover:underline"
        >
          <ChevronLeft className="flip-rtl size-4" aria-hidden />
          {t("backToSignIn")}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-26 font-semibold text-ink">{title}</h1>
        {withLanguage && <LanguageSwitch className="hidden h-8 lg:inline-flex [&_button]:h-[26px]" />}
      </div>
      {subtitle && <p className="mt-2 text-13 text-muted">{subtitle}</p>}
    </div>
  );
}
