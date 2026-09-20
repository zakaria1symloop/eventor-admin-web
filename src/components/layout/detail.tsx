"use client";

import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import { IconButton } from "@/components/ui/button";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";

/* ------------------------------------------------------------------ DetailHeader (USR-10, SRV-04…) */

export interface DetailMeta {
  icon?: ReactNode;
  label: ReactNode;
  href?: string;
}

export interface DetailHeaderProps {
  /** Person: initials avatar. */
  avatar?: { name: string; src?: string | null };
  /** Thing: icon tile (camera for services…). */
  icon?: ReactNode;
  title: ReactNode;
  badges?: ReactNode[];
  meta?: DetailMeta[];
  actions?: ReactNode;
  moreMenu?: ActionMenuItem[][];
  /** Usually LinkedCounts, shown under the header inside the same card. */
  children?: ReactNode;
  /** "card" (USR-10) or "plain" (SRV-04: sits on the canvas). */
  variant?: "card" | "plain";
  className?: string;
}

export function DetailHeader({
  avatar,
  icon,
  title,
  badges,
  meta,
  actions,
  moreMenu,
  children,
  variant = "card",
  className,
}: DetailHeaderProps) {
  const tc = useTranslations("common");
  return (
    <section
      className={cn(
        variant === "card" && "rounded-xl border border-border bg-surface p-4 sm:p-[18px]",
        "mb-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        {avatar ? (
          avatar.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.src} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-18 font-semibold text-brand">
              {initials(avatar.name)}
            </span>
          )
        ) : icon ? (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand [&_svg]:size-6">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-22 font-semibold text-ink">{title}</h1>
            {badges}
          </div>
          {meta && meta.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-13 text-muted">
              {meta.map((m, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
                  {m.icon}
                  {m.href ? (
                    <Link href={m.href} className="font-medium text-brand hover:underline">
                      {m.label}
                    </Link>
                  ) : (
                    m.label
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {(actions || moreMenu) && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {moreMenu && (
              <ActionMenu
                groups={moreMenu}
                trigger={
                  <IconButton label={tc("moreActions")} variant="outline">
                    <MoreHorizontal />
                  </IconButton>
                }
              />
            )}
          </div>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ LinkedCounts */

export interface LinkedCount {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}

export function LinkedCounts({ items, className }: { items: LinkedCount[]; className?: string }) {
  const t = useTranslations("detail");
  return (
    <dl
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-surface sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {items.map((it, i) => (
        <div key={i} className="relative border-border px-3.5 py-3 not-last:border-e max-lg:border-b">
          <dt className="flex items-center justify-between gap-2 text-12 text-muted">
            {it.label}
            {it.href && (
              <Link
                href={it.href}
                className="text-12 font-medium text-brand after:absolute after:inset-0 hover:underline"
              >
                {t("view")}{" "}
                <span aria-hidden className="inline-block rtl:-scale-x-100">
                  →
                </span>
              </Link>
            )}
          </dt>
          <dd className="mt-1 text-22 font-semibold text-ink tabular-nums">{it.value}</dd>
          {it.hint && <dd className="text-11 text-faint">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ TwoColumn */

export function TwoColumn({
  main,
  aside,
  className,
}: {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,370px)]", className)}>
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      <aside className="flex min-w-0 flex-col gap-4">{aside}</aside>
    </div>
  );
}

/* ------------------------------------------------------------------ SectionNav (SET-01) */

export interface SectionNavItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

/** Sticky anchor list; highlights the section in view. */
export function SectionNav({
  sections,
  className,
  "aria-label": ariaLabel,
}: {
  sections: SectionNavItem[];
  className?: string;
  "aria-label"?: string;
}) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("lg:sticky lg:top-[calc(var(--topbar-height)+16px)]", className)}
    >
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-3 text-13 whitespace-nowrap [&_svg]:size-4",
                  on ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-surface",
                )}
              >
                {s.icon}
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ LinkList (provider card links) */

export function CardLinkRow({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon?: ReactNode;
  label: ReactNode;
  count?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex h-10 items-center gap-2.5 px-3 text-13 text-ink hover:bg-canvas [&_svg]:size-4"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="rounded-pill bg-gray-soft px-2 text-11 text-ink-2">{count}</span>
      )}
      <ChevronRight className="flip-rtl text-faint" aria-hidden />
    </Link>
  );
}
