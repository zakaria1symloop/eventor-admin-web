/**
 * Module 2 — activity log (LOG-01 / LOG-02). Read-only.
 * `GET /admin/activity-log?actorId&action[]&objectType&objectId&level[]&source[]&from&to&q&page&limit&sort`
 * `GET /admin/activity-log/:id`
 */
import { api, type DataResponse, type ListResponse, type QueryParams } from "./client";

export type AuditLevel = "info" | "normal" | "sensitive" | "security";
export type AuditSource = "dashboard" | "android" | "ios" | "web" | "system";

export interface ActorSummary {
  id: string;
  fullName: string;
  email: string;
  role: "client" | "provider" | "admin";
  isDeleted: boolean;
}

export interface ActivityLogItem {
  id: string;
  createdAt: string;
  action: string;
  objectType: string;
  objectId: string | null;
  objectLabel: string | null;
  level: AuditLevel;
  source: AuditSource;
  actor: ActorSummary | null;
  actorRole: string | null;
  ip: string | null;
  hasChanges: boolean;
  hasNote: boolean;
}

export interface ActivityLogDetail extends ActivityLogItem {
  /** Usually `{ field: { from, to } }`. */
  changes: Record<string, unknown> | null;
  note: string | null;
  userAgent: string | null;
  requestId: string | null;
  object: { type: string; id: string | null; label: string | null };
}

export interface ActivityLogQuery {
  actorId?: string;
  action?: string[];
  objectType?: string;
  objectId?: string;
  level?: AuditLevel[];
  source?: AuditSource[];
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export const activityLogKeys = {
  all: ["activity-log"] as const,
  detail: (id: string) => [...activityLogKeys.all, "detail", id] as const,
  stats: () => [...activityLogKeys.all, "stats"] as const,
};

export function listActivityLog(query: ActivityLogQuery): Promise<ListResponse<ActivityLogItem>> {
  return api.get<ListResponse<ActivityLogItem>>("/admin/activity-log", { query: query as QueryParams });
}

export async function getActivityLogEntry(id: string): Promise<ActivityLogDetail> {
  return (await api.get<DataResponse<ActivityLogDetail>>(`/admin/activity-log/${id}`)).data;
}

/** `{ field: { from, to } }` (or `{ field: { old, new } }`) → rows for DiffList. */
export function changesToRows(changes: Record<string, unknown> | null) {
  if (!changes) return [];
  return Object.entries(changes).map(([field, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if ("from" in o || "to" in o) return { field, old: o.from, new: o.to };
      if ("old" in o || "new" in o) return { field, old: o.old, new: o.new };
    }
    return { field, old: undefined, new: v };
  });
}

/** Object type → dashboard route (LOG-02 "On" link). Unknown types have no link. */
export function objectHref(type: string, id: string | null): string | null {
  if (!id) return type === "settings" ? "/settings" : null;
  const map: Record<string, (id: string) => string> = {
    user: (i) => `/users/${i}`,
    admin: () => "/settings#admins",
    admin_invitation: () => "/settings#admins",
    service: (i) => `/services/${i}`,
    pack: (i) => `/packs/${i}`,
    booking: (i) => `/bookings/${i}`,
    dispute: (i) => `/disputes/${i}`,
    academic_request: (i) => `/academic-requests/${i}`,
    review: (i) => `/reviews/${i}`,
    conversation: (i) => `/messages/${i}`,
    category: (i) => `/categories?edit=${i}`,
    wilaya: (i) => `/locations?wilaya=${i}`,
    commune: () => "/locations",
    settings: () => "/settings",
    setting: () => "/settings",
    activity_log: (i) => `/activity-log?entry=${i}`,
  };
  return map[type]?.(id) ?? null;
}

/** Actor → profile route. */
export function actorHref(actor: ActorSummary | null): string | null {
  if (!actor || actor.isDeleted) return null;
  return actor.role === "admin" ? "/settings#admins" : `/users/${actor.id}`;
}
