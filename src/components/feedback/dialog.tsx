"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/button";
import { toneClasses, type Tone } from "@/components/ui/badge";

export const DialogRoot = RadixDialog.Root;
export const DialogClose = RadixDialog.Close;

export type DialogTone = "default" | "danger" | "success" | "warning";
export const dialogToneMap: Record<DialogTone, Tone> = {
  default: "brand",
  danger: "red",
  success: "green",
  warning: "amber",
};

export function DialogContent({
  title,
  description,
  icon,
  tone = "default",
  children,
  footer,
  width = 560,
  className,
  onInteractOutside,
  onEscapeKeyDown,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: DialogTone;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
  onInteractOutside?: (e: Event) => void;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}) {
  const t = useTranslations("common");
  const tc = toneClasses[dialogToneMap[tone]];
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#1A0D33]/35" />
      <RadixDialog.Content
        onInteractOutside={onInteractOutside}
        onEscapeKeyDown={onEscapeKeyDown}
        style={{ maxWidth: width }}
        className={cn(
          "fixed start-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-surface shadow-overlay ltr:-translate-x-1/2 rtl:translate-x-1/2",
          className,
        )}
      >
        <div className="flex items-start gap-3.5 px-6 pt-5 pb-4">
          {icon && (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
                tc.soft,
                tc.text,
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <RadixDialog.Title className="text-18 font-semibold text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-13 text-muted">
                {description}
              </RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close asChild>
            <IconButton label={t("close")} size="sm" className="-me-2 text-muted">
              <X />
            </IconButton>
          </RadixDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-[#FAFAFB] px-6 py-4">
            {footer}
          </div>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DrawerContent({
  title,
  description,
  children,
  footer,
  width = 480,
  onInteractOutside,
  onEscapeKeyDown,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  onInteractOutside?: (e: Event) => void;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}) {
  const t = useTranslations("common");
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#1A0D33]/35" />
      <RadixDialog.Content
        onInteractOutside={onInteractOutside}
        onEscapeKeyDown={onEscapeKeyDown}
        style={{ width: `min(${width}px, 100vw)` }}
        className="fixed inset-y-0 end-0 z-50 flex flex-col bg-surface shadow-overlay"
      >
        <div className="flex items-start gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1">
            <RadixDialog.Title className="text-18 font-semibold text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-0.5 text-13 text-muted">
                {description}
              </RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close asChild>
            <IconButton label={t("close")} size="sm" className="-me-2 text-muted">
              <X />
            </IconButton>
          </RadixDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
