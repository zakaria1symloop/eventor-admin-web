"use client";

import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { toneClasses, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";

/* ------------------------------------------------------------------ EmptyState (STA-01 / STA-02) */

export interface EmptyStateProps {
  icon?: ReactNode;
  tone?: Tone;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode[];
  className?: string;
}

export function EmptyState({
  icon,
  tone = "brand",
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  const t = toneClasses[tone];
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <span
        className={cn(
          "mb-4 flex size-16 items-center justify-center rounded-full [&_svg]:size-6",
          t.soft,
          t.text,
        )}
      >
        {icon ?? <Inbox />}
      </span>
      <h3 className="text-16 font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-13 text-muted">{description}</p>}
      {actions && actions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ TableSkeleton (STA-03) */

export function TableSkeleton({
  rows = 8,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-[59px] items-center gap-6 border-b border-border px-4">
          <div className="size-4 shrink-0 animate-pulse rounded-xs bg-gray-soft" />
          {Array.from({ length: columns }).map((__, c) => (
            <div key={c} className={cn("flex flex-1 flex-col gap-1.5", c === 0 && "flex-[2]")}>
              <div className="h-3 w-3/4 animate-pulse rounded-sm bg-gray-soft" />
              {c === 0 && <div className="h-2.5 w-1/2 animate-pulse rounded-sm bg-gray-soft" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)} aria-busy="true">
      <div className="h-3 w-1/3 animate-pulse rounded-sm bg-gray-soft" />
      <div className="mt-3 h-6 w-1/2 animate-pulse rounded-sm bg-gray-soft" />
      <div className="mt-3 h-2.5 w-2/5 animate-pulse rounded-sm bg-gray-soft" />
    </div>
  );
}

/* ------------------------------------------------------------------ ErrorState (STA-04) */

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  className,
}: {
  error?: unknown;
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations("states");
  const tc = useTranslations("common");
  const apiError = error instanceof ApiError ? error : null;
  return (
    <EmptyState
      className={className}
      tone="red"
      icon={<AlertTriangle />}
      title={title ?? t("errorTitle")}
      description={
        <>
          {description ?? apiError?.message ?? t("errorDescription")}
          {apiError?.requestId && (
            <span className="mt-1 block text-12 text-faint">
              {t("requestId", { id: apiError.requestId })}
            </span>
          )}
        </>
      }
      actions={
        onRetry
          ? [
              <Button key="retry" variant="secondary" onClick={onRetry}>
                {tc("tryAgain")}
              </Button>,
            ]
          : undefined
      }
    />
  );
}
