import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Link } from "@/i18n/navigation";

const avatarTones = [
  "bg-blue-soft text-blue",
  "bg-brand-soft text-brand",
  "bg-gold-soft text-gold",
  "bg-gray-soft text-ink-2",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** avatar + name + sub */
export function UserCell({
  name,
  sub,
  href,
  tone,
}: {
  name: string;
  sub?: ReactNode;
  href?: string;
  tone?: number;
}) {
  const toneClass = avatarTones[(tone ?? name.length) % avatarTones.length];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-12 font-semibold",
          toneClass,
        )}
      >
        {initials(name)}
      </span>
      <span className="min-w-0 leading-tight">
        {href ? (
          <Link
            href={href}
            className="block truncate text-14 font-medium text-ink hover:text-brand"
            title={name}
          >
            {name}
          </Link>
        ) : (
          <span className="block truncate text-14 font-medium text-ink" title={name}>
            {name}
          </span>
        )}
        {sub && <span className="block truncate text-12 text-muted">{sub}</span>}
      </span>
    </div>
  );
}

/** absolute date, localised */
export function DateCell({ value, locale }: { value: string; locale: string }) {
  const d = new Date(value);
  const text = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
  return (
    <time dateTime={value} className="text-ink-2">
      {text}
    </time>
  );
}
