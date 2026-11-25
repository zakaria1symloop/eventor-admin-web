/**
 * Public app-account routes used by the web pages the API emails (BUG-L4, `/set-password`).
 * No dashboard session: every call is `public` (no Authorization header, no refresh on 401).
 */
import { api, type DataResponse } from "./client";
import type { components } from "./schema";

type S = components["schemas"];

/** `POST /app/auth/set-password/check` → who the link is for. */
export type SetPasswordLink = S["AppSetPasswordCheckResultDto"];

export interface StoreUrls {
  android: string | null;
  ios: string | null;
}

/** Same rule as the app and the API (422 PASSWORD_WEAK): 10–128 characters, a letter and a digit. */
export const APP_PASSWORD_MIN = 10;
export const APP_PASSWORD_MAX = 128;

export const appAuthKeys = {
  setPasswordLink: (token: string) => ["app-auth", "set-password", token] as const,
  storeUrls: () => ["app-auth", "store-urls"] as const,
};

/** Checks the emailed link without using it. 400 RESET_TOKEN_INVALID, 410 RESET_TOKEN_EXPIRED, 403 ACCOUNT_BLOCKED. */
export async function checkSetPasswordLink(token: string): Promise<SetPasswordLink> {
  const res = await api.post<DataResponse<SetPasswordLink>>(
    "/app/auth/set-password/check",
    { token },
    { public: true },
  );
  return res.data;
}

/**
 * Sets the password (single use). The API answers an app session; the dashboard must not keep it,
 * so only the account email is returned and the tokens are dropped here.
 */
export async function setAppPassword(token: string, password: string): Promise<{ email: string }> {
  const res = await api.post<DataResponse<S["AppSessionDto"]>>(
    "/app/auth/set-password",
    { token, password },
    { public: true },
  );
  return { email: res.data.user.email };
}

/** `GET /app/config` → `storeUrls` (null until the app is published on that store). */
export async function getStoreUrls(): Promise<StoreUrls> {
  const res = await api.get<DataResponse<S["AppConfigDto"]>>("/app/config", { public: true });
  const urls = res.data.storeUrls as unknown as Partial<StoreUrls> | null | undefined;
  return { android: urls?.android || null, ios: urls?.ios || null };
}
