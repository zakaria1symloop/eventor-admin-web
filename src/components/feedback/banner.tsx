import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { toneClasses, type Tone } from "@/components/ui/badge";

const defaultIcons: Partial<Record<Tone, ReactNode>> = {
  red: <OctagonAlert />,
  amber: <AlertTriangle />,
  green: <CheckCircle2 />,
  blue: <Info />,
  brand: <Info />,
};

export interface BannerProps {
  tone?: Tone;
  icon?: ReactNode | false;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Banner({ tone = "blue", icon, title, description, action, className }: BannerProps) {
  const t = toneClasses[tone];
  const shownIcon = icon === false ? null : (icon ?? defaultIcons[tone]);
  return (
    <div
      role={tone === "red" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg px-4 py-3", t.soft, className)}
    >
      {shownIcon && <span className={cn("mt-0.5 shrink-0 [&_svg]:size-[18px]", t.text)}>{shownIcon}</span>}
      <div className="min-w-0 flex-1">
        <div className={cn("text-13 font-medium", t.text)}>{title}</div>
        {description && <div className="mt-0.5 text-13 text-ink-2">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
