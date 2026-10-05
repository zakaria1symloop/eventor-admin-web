"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { refreshSession, setAuthFailureHandler, takeSignOutReason } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token";
import { useSession } from "@/lib/auth/use-session";
import { ErrorState } from "@/components/feedback/states";

/**
 * Protects the (app) route group (on unless NEXT_PUBLIC_AUTH_ENABLED=false).
 * No in-memory token → POST /admin/auth/refresh (cookie) → GET /admin/me.
 * Rejected session → /login?next=…; API unreachable → ErrorState with retry.
 */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED !== "false";

type GuardState = "checking" | "ready" | "offline";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>(AUTH_ENABLED ? "checking" : "ready");
  const [attempt, setAttempt] = useState(0);

  const toLogin = useCallback(() => {
    const qs = typeof window !== "undefined" ? window.location.search : "";
    const reason = takeSignOutReason();
    router.replace(`/login?next=${encodeURIComponent(`${pathname}${qs}`)}${reason ? `&reason=${reason}` : ""}`);
  }, [router, pathname]);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    setAuthFailureHandler(toLogin);
    return () => setAuthFailureHandler(null);
  }, [toLogin]);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let cancelled = false;
    (async () => {
      const result = tokenStore.get() !== null ? "ok" : await refreshSession();
      if (cancelled) return;
      if (result === "ok") setState("ready");
      else if (result === "network") setState("offline");
      else toLogin();
    })();
    return () => {
      cancelled = true;
    };
    // Only on mount / retry — navigation inside the app keeps the token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const session = useSession({ enabled: AUTH_ENABLED && state === "ready" });

  const retry = () => {
    setState("checking");
    setAttempt((a) => a + 1);
    if (tokenStore.get() !== null) void session.refetch();
  };

  if (!AUTH_ENABLED) return <>{children}</>;

  const sessionOffline =
    session.isError && !(session.error instanceof ApiError && session.error.status === 401);
  if (state === "offline" || sessionOffline) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <ErrorState error={session.error} onRetry={retry} />
      </div>
    );
  }
  if (state !== "ready" || !session.data) {
    return <div aria-busy="true" className="min-h-dvh bg-canvas" />;
  }
  return <>{children}</>;
}
