"use client";

import { GripVertical, Star } from "lucide-react";
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";
import { Toggle } from "@/components/forms/fields";
import { StatusBadge, type StatusDomain } from "@/components/ui/status-badge";
import { ConfirmDialog, type ConfirmDialogProps } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";

/** icon thumb + title + sub */
export function EntityCell({
  icon,
  thumb,
  title,
  sub,
  href,
}: {
  icon?: ReactNode;
  thumb?: string | null;
  title: ReactNode;
  sub?: ReactNode;
  href?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="size-9 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand [&_svg]:size-4">
          {icon}
        </span>
      )}
      <span className="min-w-0 leading-tight">
        {href ? (
          <Link href={href} className="block truncate text-14 font-medium text-ink hover:text-brand">
            {title}
          </Link>
        ) : (
          <span className="block truncate text-14 font-medium text-ink">{title}</span>
        )}
        {sub && <span className="block truncate text-12 text-muted">{sub}</span>}
      </span>
    </div>
  );
}

/** brand link + sub */
export function LinkCell({ label, href, sub }: { label: ReactNode; href: string; sub?: ReactNode }) {
  return (
    <span className="block min-w-0 leading-tight">
      <Link
        href={href}
        className="block truncate text-13 font-medium text-brand hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </Link>
      {sub && <span className="block truncate text-12 text-muted">{sub}</span>}
    </span>
  );
}

/** two stacked lines */
export function StackCell({
  primary,
  secondary,
  align = "start",
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <span className={cn("block min-w-0 leading-tight", align === "end" && "text-end")}>
      <span className="block truncate text-13 text-ink">{primary}</span>
      {secondary && <span className="block truncate text-12 text-muted">{secondary}</span>}
    </span>
  );
}

/** DZD value + optional sub (saving in green). */
export function MoneyCell({
  value,
  sub,
  subTone = "muted",
}: {
  value: string | number | null;
  sub?: ReactNode;
  subTone?: "muted" | "green";
}) {
  const locale = useLocale();
  return (
    <span className="block leading-tight whitespace-nowrap" dir="ltr">
      <span className="block text-13 font-semibold text-ink tabular-nums">{formatMoney(value, locale)}</span>
      {sub && (
        <span className={cn("block text-12", subTone === "green" ? "text-green" : "text-muted")}>{sub}</span>
      )}
    </span>
  );
}

/** ★ 4.8 (32) or "No reviews" */
export function RatingCell({ value, count }: { value: number | null; count?: number }) {
  const t = useTranslations("cells");
  if (value === null || !count) return <span className="text-13 text-faint">{t("noReviews")}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-13 text-ink tabular-nums">
      <Star className="size-3.5 fill-gold text-gold" aria-hidden />
      <span className="font-medium">{value.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

export function StatusBadgeCell({ domain, status }: { domain: StatusDomain; status: string }) {
  return <StatusBadge domain={domain} status={status} />;
}

/** "31 bookings" link to a filtered list; 0 is muted. */
export function CountLinkCell({
  count,
  href,
  label,
}: {
  count: number;
  href: string;
  label?: (count: number) => ReactNode;
}) {
  const text = label ? label(count) : count;
  if (count === 0) return <span className="text-13 text-faint">{text}</span>;
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="text-13 font-medium text-brand tabular-nums hover:underline"
    >
      {text}
    </Link>
  );
}

/** Switch in a row. `confirm(next)` returns dialog props when the change must be confirmed. Optimistic. */
export function ToggleCell({
  checked,
  onChange,
  confirm,
  label,
  successMessage,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => Promise<void> | void;
  confirm?: (
    next: boolean,
  ) => Pick<ConfirmDialogProps, "title" | "description" | "impact" | "confirmLabel" | "tone"> | null;
  label: string;
  successMessage?: (next: boolean) => ReactNode;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<boolean | null>(null);
  const shown = optimistic ?? checked;

  async function apply(next: boolean) {
    setOptimistic(next);
    try {
      await onChange(next);
      if (successMessage) toast.success(successMessage(next));
    } catch (e) {
      toast.apiError(e);
    } finally {
      setOptimistic(null);
    }
  }

  const dialog = pendingConfirm !== null && confirm ? confirm(pendingConfirm) : null;

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <Toggle
        aria-label={label}
        checked={shown}
        disabled={disabled || optimistic !== null}
        onCheckedChange={(next) => {
          if (confirm?.(next)) setPendingConfirm(next);
          else void apply(next);
        }}
      />
      {dialog && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPendingConfirm(null)}
          {...dialog}
          onConfirm={async () => {
            const next = pendingConfirm as boolean;
            await onChange(next);
            if (successMessage) toast.success(successMessage(next));
          }}
        />
      )}
    </span>
  );
}

/** Arabic text (dir=rtl, Cairo) or a red "Missing translation". */
export function BilingualCell({
  ar,
  en,
  onMissingClick,
}: {
  ar: string | null;
  en?: string | null;
  onMissingClick?: () => void;
}) {
  const t = useTranslations("cells");
  return (
    <span className="block min-w-0 leading-tight">
      {en && <span className="block truncate text-13 text-ink">{en}</span>}
      {ar?.trim() ? (
        <span dir="rtl" lang="ar" className="block truncate font-arabic text-13 text-ink-2">
          {ar}
        </span>
      ) : onMissingClick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMissingClick();
          }}
          className="text-12 font-medium text-red hover:underline"
        >
          {t("missingTranslation")}
        </button>
      ) : (
        <span className="text-12 font-medium text-red">{t("missingTranslation")}</span>
      )}
    </span>
  );
}

/** Drag handle; spread your dnd listeners/attributes on it. */
export const DragHandleCell = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }
>(function DragHandleCell({ label, className, ...props }, ref) {
  const t = useTranslations("cells");
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label ?? t("dragToReorder")}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex size-7 cursor-grab items-center justify-center rounded-sm text-faint hover:bg-gray-soft hover:text-ink-2 active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
});
