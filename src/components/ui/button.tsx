import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline" | "ghost";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover border border-brand",
  secondary: "bg-surface text-ink border border-border hover:bg-canvas",
  danger: "bg-red text-white border border-red hover:brightness-95",
  "danger-outline": "bg-surface text-red border border-red/30 hover:bg-red-soft",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-gray-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-13 gap-1.5",
  md: "h-[34px] px-3.5 text-14 gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    iconEnd,
    loading,
    disabled,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
      {iconEnd}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: every icon button has a label (a11y). */
  label: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors disabled:opacity-50 [&_svg]:size-[18px]",
        variant === "outline" ? "border border-border bg-surface hover:bg-canvas" : "hover:bg-gray-soft",
        size === "sm" ? "size-8" : "size-9",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
