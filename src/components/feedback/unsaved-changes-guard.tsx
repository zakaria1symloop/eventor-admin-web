"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogRoot } from "./dialog";

interface GuardContext {
  /** Runs `action` immediately when clean, otherwise after the admin confirms "Discard". */
  confirmLeave: (action: () => void) => void;
}

const Ctx = createContext<GuardContext>({ confirmLeave: (action) => action() });
export const useUnsavedChanges = () => useContext(Ctx);

/**
 * STA-06. Wraps a form; when `when` is true it intercepts:
 * - tab close / reload (beforeunload)
 * - in-app link clicks (anchors inside the document)
 * - browser back (popstate)
 * - drawer/dialog close, via `useUnsavedChanges().confirmLeave`.
 */
export function UnsavedChangesGuard({ when, children }: { when: boolean; children: ReactNode }) {
  const t = useTranslations("states");
  const tc = useTranslations("common");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const whenRef = useRef(when);
  useEffect(() => {
    whenRef.current = when;
  }, [when]);

  const confirmLeave = useCallback((action: () => void) => {
    if (!whenRef.current) action();
    else setPendingAction(() => action);
  }, []);

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingAction(() => () => {
        window.location.assign(url.toString());
      });
    };
    // Back button: push a sentinel entry, intercept its pop.
    window.history.pushState({ __unsavedGuard: true }, "");
    const onPopState = () => {
      if (!whenRef.current) return;
      window.history.pushState({ __unsavedGuard: true }, "");
      setPendingAction(() => () => {
        whenRef.current = false;
        window.history.go(-2);
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [when]);

  return (
    <Ctx.Provider value={{ confirmLeave }}>
      {children}
      <DialogRoot open={pendingAction !== null} onOpenChange={(o) => !o && setPendingAction(null)}>
        <DialogContent
          title={t("unsavedTitle")}
          description={t("unsavedDescription")}
          tone="warning"
          width={440}
          footer={
            <>
              <span className="me-auto" />
              <Button variant="secondary" onClick={() => setPendingAction(null)}>
                {tc("keepEditing")}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const action = pendingAction;
                  setPendingAction(null);
                  action?.();
                }}
              >
                {tc("discard")}
              </Button>
            </>
          }
        />
      </DialogRoot>
    </Ctx.Provider>
  );
}
