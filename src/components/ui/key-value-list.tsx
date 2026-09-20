import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export interface KeyValueRow {
  label: ReactNode;
  value: ReactNode;
  href?: string;
}

export function KeyValueList({ rows, className }: { rows: KeyValueRow[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-transparent", className)}>
      {rows.map((row, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2 text-13">
          <dt className="shrink-0 text-muted">{row.label}</dt>
          <dd className="min-w-0 truncate text-end text-ink">
            {row.href ? (
              <Link href={row.href} className="font-medium text-brand hover:underline">
                {row.value}
              </Link>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
