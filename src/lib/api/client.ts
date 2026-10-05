import { ApiError, toApiError } from "./errors";
import { tokenStore } from "./token";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "");

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  query?: QueryParams;
  body?: unknown;
  /** Skip the Authorization header and 401 refresh (auth endpoints). */
  public?: boolean;
}

/** Standard list shape (api-standards §4). */
export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}
export interface DataResponse<T> {
  data: T;
}

let currentLocale = "en";
/** Called by the providers so every request sends Accept-Language. */
export function setApiLocale(locale: string) {
  currentLocale = locale;
}

type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler | null = null;
/** Called when refresh fails (redirect to /login — STA-04 401 → SHL-03). */
export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  onAuthFailure = handler;
}

export function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

export type RefreshResult = "ok" | "unauthorized" | "network";
let refreshPromise: Promise<RefreshResult> | null = null;

/** Why the last refresh was refused: `replaced` when this admin signed in on another computer (AUTH_SESSION_REPLACED). */
let signOutReason: "replaced" | null = null;
/** Read once by the login redirect, so the login page can say why the session ended. */
export function takeSignOutReason(): "replaced" | null {
  const reason = signOutReason;
  signOutReason = null;
  return reason;
}

/**
 * POST /admin/auth/refresh (module 1): httpOnly cookie in,
 * `{ data: { accessToken, expiresIn, user } }` out. Distinguishes a rejected
 * session (→ login) from an unreachable API (→ ErrorState).
 */
export function refreshSession(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = (async (): Promise<RefreshResult> => {
      try {
        // Refresh tokens rotate: serialize across tabs too (Web Locks), so two tabs
        // never present the same cookie at once.
        const doFetch = () =>
          fetch(buildUrl("/admin/auth/refresh"), {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json", "Accept-Language": currentLocale },
          });
        const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
        const res = locks ? await locks.request("eventor-admin-refresh", doFetch) : await doFetch();
        if (!res.ok) {
          tokenStore.clear();
          if (res.status === 401) {
            const body = (await res.json().catch(() => null)) as { code?: string } | null;
            if (body?.code === "AUTH_SESSION_REPLACED") signOutReason = "replaced";
          }
          // 429 (auth throttle) is transient: keep the user on the page instead of signing them out.
          return res.status >= 500 || res.status === 429 ? "network" : "unauthorized";
        }
        const json = (await res.json()) as DataResponse<{ accessToken: string }>;
        tokenStore.set(json.data.accessToken);
        return "ok";
      } catch {
        tokenStore.clear();
        return "network";
      } finally {
        // allow a new refresh on the next 401
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

export async function refreshAccessToken(): Promise<boolean> {
  return (await refreshSession()) === "ok";
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { query, body, public: isPublic, headers, ...init } = options;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  h.set("Accept-Language", currentLocale);
  const token = tokenStore.get();
  if (!isPublic && token) h.set("Authorization", `Bearer ${token}`);

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    h.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  return fetch(buildUrl(path, query), {
    ...init,
    headers: h,
    body: payload,
    credentials: "include",
  });
}

type WriteListener = (path: string) => void;
const writeListeners = new Set<WriteListener>();
/** Called after every successful non-GET request (sidebar counters refresh after an action). */
export function onApiWrite(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

/** Fetch wrapper: JSON in/out, standard error parsing, one refresh retry on 401. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options);
  } catch (cause) {
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: cause instanceof Error ? cause.message : "Network error",
    });
  }

  if (response.status === 401 && !options.public) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(path, options);
    }
    if (response.status === 401) {
      onAuthFailure?.();
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (options.method && options.method !== "GET" && !options.public && !path.startsWith("/admin/auth")) {
    for (const listener of writeListeners) listener(path);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};
