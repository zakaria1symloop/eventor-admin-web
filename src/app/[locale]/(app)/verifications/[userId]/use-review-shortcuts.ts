"use client";

import { useEffect, useRef } from "react";

export interface ReviewShortcuts {
  /** A */
  onApprove?: () => void;
  /** R */
  onReject?: () => void;
  /** J */
  onNext?: () => void;
  /** K */
  onPrev?: () => void;
  enabled?: boolean;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * VER-02 keyboard: A approve, R reject, J next / K previous in the queue.
 * Ignored while typing, with modifier keys, or when a dialog is open.
 */
export function useReviewShortcuts(handlers: ReviewShortcuts) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const h = ref.current;
      if (h.enabled === false || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTyping(e.target)) return;
      if (
        document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')
      )
        return;
      const map: Record<string, (() => void) | undefined> = {
        a: h.onApprove,
        r: h.onReject,
        j: h.onNext,
        k: h.onPrev,
      };
      const fn = map[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
