/**
 * Module 1 — admin auth, my account and admin accounts.
 * Typed request functions + query keys. Contract: see README "Module 1 API contract".
 */
import { api, type DataResponse, type ListResponse } from "./client";
import type { components } from "./schema";
import { tokenStore } from "./token";

type Schemas = components["schemas"];

export type AdminLanguage = Schemas["AdminMeDto"]["language"];

export type AdminMe = Schemas["AdminMeDto"];

export type LoginResult = Schemas["AuthSessionDto"];

export interface LoginBody {
  email: string;
  password: string;
  remember?: boolean;
}

export type InvitationPreview = Schemas["InvitationPreviewDto"];

export type AdminSession = Schemas["SessionDto"];

export type AdminAccount = Schemas["AdminListItemDto"];

export type UpdateMeBody = Schemas["UpdateMeDto"];

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
  sessions: () => [...authKeys.all, "sessions"] as const,
  invitation: (token: string) => [...authKeys.all, "invitation", token] as const,
};

export const adminKeys = {
  all: ["admins"] as const,
  list: () => [...adminKeys.all, "list"] as const,
};

/* ------------------------------------------------------------------ auth (public) */

export async function login(body: LoginBody): Promise<LoginResult> {
  const res = await api.post<DataResponse<LoginResult>>("/admin/auth/login", body, { public: true });
  tokenStore.set(res.data.accessToken);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post<void>("/admin/auth/logout", undefined, { public: true });
  } finally {
    tokenStore.clear();
  }
}

export function forgotPassword(email: string): Promise<void> {
  return api.post<void>("/admin/auth/forgot", { email }, { public: true });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return api.post<void>("/admin/auth/reset", { token, password }, { public: true });
}

export async function getInvitation(token: string): Promise<InvitationPreview> {
  const res = await api.get<DataResponse<InvitationPreview>>(
    `/admin/auth/invitations/${encodeURIComponent(token)}`,
    { public: true },
  );
  return res.data;
}

export async function acceptInvitation(token: string, password: string): Promise<LoginResult> {
  const res = await api.post<DataResponse<LoginResult>>(
    `/admin/auth/invitations/${encodeURIComponent(token)}/accept`,
    { password },
    { public: true },
  );
  tokenStore.set(res.data.accessToken);
  return res.data;
}

/* ------------------------------------------------------------------ me */

export async function getMe(): Promise<AdminMe> {
  return (await api.get<DataResponse<AdminMe>>("/admin/me")).data;
}

export async function updateMe(body: UpdateMeBody): Promise<AdminMe> {
  return (await api.patch<DataResponse<AdminMe>>("/admin/me", body)).data;
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api.post<void>("/admin/me/password", { currentPassword, newPassword });
}

export async function getSessions(): Promise<AdminSession[]> {
  return (await api.get<DataResponse<AdminSession[]>>("/admin/me/sessions")).data;
}

export function revokeSession(id: string): Promise<void> {
  return api.delete<void>(`/admin/me/sessions/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ admin accounts (SET-01 / SET-02) */

export function listAdmins(): Promise<ListResponse<AdminAccount>> {
  return api.get<ListResponse<AdminAccount>>("/admin/admins", { query: { limit: 100 } });
}

export async function inviteAdmin(body: Schemas["CreateInvitationDto"]): Promise<AdminAccount> {
  return (await api.post<DataResponse<AdminAccount>>("/admin/admins/invitations", body)).data;
}

export async function resendInvitation(id: string): Promise<AdminAccount> {
  return (
    await api.post<DataResponse<AdminAccount>>(`/admin/admins/invitations/${encodeURIComponent(id)}/resend`)
  ).data;
}

export function revokeInvitation(id: string): Promise<void> {
  return api.post<void>(`/admin/admins/invitations/${encodeURIComponent(id)}/revoke`);
}

export function removeAdmin(id: string): Promise<void> {
  return api.delete<void>(`/admin/admins/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ shared validation */

/** Password rule shared with the API (PASSWORD_WEAK): ≥ 10 chars with a letter and a digit. */
export function isStrongPassword(value: string) {
  return value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

/** Only same-app relative paths are allowed as `?next=`. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Drop a locale prefix; the router adds the current one.
  return next.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
}
