import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface HistoryItem {
  key: string;
  title: ReactNode;
  meta?: ReactNode;
}

/** Dot list of events, newest first (BKG-03 History, ActivityFeed). */
export function HistoryList({
  items,
  empty,
  className,
}: {
  items: HistoryItem[];
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) return <p className={cn("text-13 text-muted", className)}>{empty}</p>;
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((it) => (
        <li key={it.key} className="flex items-start gap-3">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
          <span className="min-w-0 leading-tight">
            <span className="block text-13 text-ink">{it.title}</span>
            {it.meta && <span className="block text-12 text-muted">{it.meta}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
