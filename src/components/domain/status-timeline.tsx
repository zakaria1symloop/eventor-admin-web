import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type TimelineStepState = "done" | "now" | "next" | "failed";

export interface TimelineStep {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  state: TimelineStepState;
}

/** Horizontal steps (BKG-03): done ✓ green, now ● amber, next ○ grey, failed ✕ red. */
export function StatusTimeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol
      className={cn("grid gap-4 sm:gap-0", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}
    >
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={s.key}
            aria-current={s.state === "now" ? "step" : undefined}
            className="relative min-w-0 pe-3"
            data-state={s.state}
          >
            <div className="flex items-center">
              <span
                className={cn(
                  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-3.5",
                  s.state === "done" && "border-green bg-green text-white",
                  s.state === "now" && "border-amber bg-surface",
                  s.state === "next" && "border-border bg-surface",
                  s.state === "failed" && "border-red bg-red text-white",
                )}
              >
                {s.state === "done" && <Check strokeWidth={3} aria-hidden />}
                {s.state === "failed" && <X strokeWidth={3} aria-hidden />}
                {s.state === "now" && <span className="size-2.5 rounded-full bg-amber" aria-hidden />}
              </span>
              {!last && (
                <span
                  aria-hidden
                  className={cn("mx-1 h-0.5 flex-1", s.state === "done" ? "bg-green" : "bg-border")}
                />
              )}
            </div>
            <div
              className={cn(
                "mt-2 truncate text-13 font-medium",
                s.state === "next" ? "text-muted" : "text-ink",
              )}
            >
              {s.label}
            </div>
            {s.sub && (
              <div
                className={cn(
                  "truncate text-12",
                  s.state === "now" ? "text-amber" : s.state === "failed" ? "text-red" : "text-faint",
                )}
              >
                {s.sub}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
