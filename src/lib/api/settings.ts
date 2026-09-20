/**
 * Module 2 — platform settings (SET-01).
 * `GET /admin/settings` → sections; `PATCH /admin/settings { values, confirm?, note?, expectedUpdatedAt? }`.
 * 409 SETTINGS_CONFIRM_REQUIRED `details.diff` → confirm dialog, resend with `confirm: true`.
 * 409 STALE_UPDATE `details.keys` → "changed by someone else" banner.
 */
import { api, type DataResponse } from "./client";
import { ApiError } from "./errors";

export type SettingType =
  | "integer"
  | "decimal"
  | "boolean"
  | "string"
  | "email"
  | "url"
  | "phone"
  | "version"
  | "enum_list"
  | "object";

export type SettingValue = number | boolean | string | string[] | Record<string, unknown>;

export interface UserSummary {
  id: string;
  fullName: string;
}

export interface SettingItem {
  key: string;
  value: SettingValue;
  defaultValue?: SettingValue;
  type: SettingType;
  min: number | null;
  max: number | null;
  maxLength?: number | null;
  options?: string[] | null;
  sensitive: boolean;
  updatedAt: string | null;
  updatedBy: UserSummary | null;
}

export type SettingSectionKey =
  "commission" | "bookings" | "uploads" | "languages" | "notifications" | "support" | "maintenance";

export interface SettingsSection {
  key: SettingSectionKey;
  settings: SettingItem[];
}

export interface Settings {
  sections: SettingsSection[];
}

export interface SettingDiff {
  key: string;
  old: SettingValue | null;
  new: SettingValue | null;
}

export interface UpdateSettingsBody {
  values: Record<string, SettingValue>;
  confirm?: boolean;
  note?: string;
  expectedUpdatedAt?: Record<string, string | null>;
}

export interface InvoiceIssuer {
  name: string;
  address: string;
  nif: string;
  rc: string;
  email: string;
  phone: string;
}

export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => [...settingsKeys.all, "detail"] as const,
};

export async function getSettings(): Promise<Settings> {
  return (await api.get<DataResponse<Settings>>("/admin/settings")).data;
}

export async function updateSettings(body: UpdateSettingsBody): Promise<Settings> {
  return (await api.patch<DataResponse<Settings>>("/admin/settings", body)).data;
}

/** `details.diff` of a SETTINGS_CONFIRM_REQUIRED error, or null. */
export function confirmDiff(error: unknown): SettingDiff[] | null {
  if (!(error instanceof ApiError) || error.code !== "SETTINGS_CONFIRM_REQUIRED") return null;
  const d = error.details as { diff?: SettingDiff[] } | null;
  return Array.isArray(d?.diff) ? d.diff : [];
}

export function flattenSettings(settings: Settings): Record<string, SettingItem> {
  const out: Record<string, SettingItem> = {};
  for (const s of settings.sections) for (const item of s.settings) out[item.key] = item;
  return out;
}
