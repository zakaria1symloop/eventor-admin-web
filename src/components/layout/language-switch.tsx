"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

/** EN / عربي segmented switch; keeps the current path and query string. */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function select(next: Locale) {
    if (next === locale) return;
    // Read the query at click time (avoids a useSearchParams Suspense bailout in the shell).
    const qs = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const href = qs ? `${pathname}?${qs}` : pathname;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    startTransition(() => {
      router.replace(`${href}${hash}`, { locale: next, scroll: false });
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("switchTo")}
      aria-busy={isPending || undefined}
      className={cn("inline-flex h-9 items-center rounded-pill bg-gray-soft p-[3px]", className)}
    >
      {locales.map((l) => {
        const selected = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={l}
            onClick={() => select(l)}
            className={cn(
              "h-[30px] min-w-[42px] rounded-pill px-3 text-13 font-medium transition-colors",
              selected ? "bg-brand text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            {t(l)}
          </button>
        );
      })}
    </div>
  );
}
