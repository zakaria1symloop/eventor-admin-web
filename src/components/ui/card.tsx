import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
  actions,
  titleAddon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Single link-style action ("Open profile ›"). */
  action?: ReactNode;
  /** Buttons (e.g. "+ Invite admin"), rendered as-is. */
  actions?: ReactNode;
  /** Pill next to the title ("Both languages filled"). */
  titleAddon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-[18px] py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-15 font-semibold text-ink">{title}</h2>
          {titleAddon}
        </div>
        {subtitle && <p className="mt-0.5 text-12 text-muted">{subtitle}</p>}
      </div>
      {(action || actions) && (
        <div className="flex shrink-0 items-center gap-2">
          {action && <div className="text-13 font-medium text-brand">{action}</div>}
          {actions}
        </div>
      )}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-[18px] py-4", className)} {...props} />;
}
