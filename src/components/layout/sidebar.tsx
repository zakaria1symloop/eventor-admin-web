"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { Count, type Tone } from "@/components/ui/badge";
import { findActiveNav, navGroups, type NavKey } from "./nav-config";

export type SidebarBadges = Partial<Record<NavKey, { count: number; tone?: Tone }>>;

export interface SidebarProps {
  /** Overrides the active item derived from the URL. */
  active?: NavKey;
  badges?: SidebarBadges;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ active, badges = {}, onNavigate, className }: SidebarProps) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const current = active ?? findActiveNav(pathname);

  return (
    <aside
      className={cn(
        "flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-e border-border bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-[22px] pt-6 pb-5">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md bg-brand text-16 font-semibold text-white"
        >
          E
        </span>
        <span className="leading-tight">
          <span className="block text-15 font-semibold text-ink">{tApp("name")}</span>
          <span className="block text-12 text-muted">{tApp("panel")}</span>
        </span>
      </div>

      <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-3.5 pb-6">
        {navGroups.map((group) => (
          <div key={group.key} className={cn(group.key !== "overview" && "mt-5")}>
            {group.key !== "overview" && (
              <div className="px-2.5 pb-2 text-11 font-medium tracking-[0.08em] text-muted uppercase">
                {t(`groups.${group.key}`)}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = item.key === current;
                const badge = badges[item.key];
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-md px-2.5 text-14 transition-colors",
                        isActive
                          ? "bg-brand-soft font-medium text-brand"
                          : "text-ink-2 hover:bg-canvas hover:text-ink",
                      )}
                    >
                      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
                      <span className="flex-1 truncate">{t(item.key)}</span>
                      {badge && badge.count > 0 && <Count tone={badge.tone ?? "brand"}>{badge.count}</Count>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
