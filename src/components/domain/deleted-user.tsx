"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LinkCell } from "@/components/data-list";
import { Pill } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/** BUG-M5 — shown next to a person whose account was deleted (their profile answers 404). */
export function DeletedUserBadge({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Pill tone="gray" className={cn("shrink-0", className)}>
      {t("deletedUser")}
    </Pill>
  );
}

/** A person in a list cell: a profile link, or — once the account is deleted — the name, a badge and no link. */
export function PersonCell({
  label,
  href,
  sub,
  deleted,
}: {
  label: ReactNode;
  href: string;
  sub?: ReactNode;
  deleted?: boolean;
}) {
  if (!deleted) return <LinkCell label={label} href={href} sub={sub} />;
  return (
    <span className="block min-w-0 leading-tight">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-13 font-medium text-ink-2">{label}</span>
        <DeletedUserBadge />
      </span>
      {sub && <span className="block truncate text-12 text-muted">{sub}</span>}
    </span>
  );
}
