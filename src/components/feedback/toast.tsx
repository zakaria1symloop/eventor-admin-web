"use client";

import type { ReactNode } from "react";
import { toast as sonner, Toaster as SonnerToaster } from "sonner";
import { ApiError } from "@/lib/api/errors";

export interface ToastOptions {
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** ms; Undo toasts default to 8 s (screen map USR-13). */
  duration?: number;
}

function withDefaults(opts?: ToastOptions) {
  return {
    description: opts?.description,
    action: opts?.action,
    duration: opts?.duration ?? (opts?.action ? 8000 : 4000),
  };
}

export const toast = {
  success: (title: ReactNode, opts?: ToastOptions) => sonner.success(title, withDefaults(opts)),
  error: (title: ReactNode, opts?: ToastOptions) => sonner.error(title, withDefaults(opts)),
  info: (title: ReactNode, opts?: ToastOptions) => sonner.info(title, withDefaults(opts)),
  /** Red toast for a failed action, using the API message + request id. */
  apiError: (error: unknown, fallback = "Something went wrong") => {
    const e = error instanceof ApiError ? error : null;
    return sonner.error(e?.message ?? fallback, {
      description: e?.requestId ? `Request ID: ${e.requestId}` : undefined,
    });
  },
  dismiss: sonner.dismiss,
};

export function Toaster({ dir }: { dir: "ltr" | "rtl" }) {
  return (
    <SonnerToaster
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-surface !text-ink !shadow-overlay !font-[inherit]",
          title: "!text-14 !font-medium",
          description: "!text-13 !text-muted",
          actionButton: "!bg-brand !text-white !rounded-md",
          success: "[&_[data-icon]]:!text-green",
          error: "[&_[data-icon]]:!text-red",
        },
      }}
    />
  );
}
