import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Tone = "brand" | "green" | "amber" | "red" | "blue" | "gold" | "gray";

export const toneClasses: Record<Tone, { soft: string; text: string; dot: string }> = {
  brand: { soft: "bg-brand-soft", text: "text-brand", dot: "bg-brand" },
  green: { soft: "bg-green-soft", text: "text-green", dot: "bg-green" },
  amber: { soft: "bg-amber-soft", text: "text-amber", dot: "bg-amber" },
  red: { soft: "bg-red-soft", text: "text-red", dot: "bg-red" },
  blue: { soft: "bg-blue-soft", text: "text-blue", dot: "bg-blue" },
  gold: { soft: "bg-gold-soft", text: "text-gold", dot: "bg-gold" },
  gray: { soft: "bg-gray-soft", text: "text-muted", dot: "bg-muted" },
};

/** Rounded label with an optional leading dot (Figma: "● Active"). */
export function Pill({
  tone = "gray",
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-pill px-2 text-12 font-medium whitespace-nowrap",
        t.soft,
        t.text,
        className,
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}

/** Small number chip (sidebar badges, tab counts). */
export function Count({
  tone = "gray",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-pill px-1.5 text-11 font-medium tabular-nums",
        t.soft,
        tone === "gray" ? "text-ink-2" : t.text,
        className,
      )}
    >
      {children}
    </span>
  );
}
