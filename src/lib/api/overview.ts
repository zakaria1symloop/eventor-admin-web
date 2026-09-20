/**
 * Module 13 — overview (OVR-01), sidebar counters, global search (SHL-01).
 * `GET /admin/overview?range&from&to`, `GET /admin/nav-counts`, `GET /admin/search?q&scope&limit`.
 */
import { api, type DataResponse, type QueryParams } from "./client";
import type { BookingStatus } from "./bookings";

export type OverviewRange = "today" | "7d" | "30d" | "this_month" | "custom";
export const OVERVIEW_RANGES: OverviewRange[] = ["today", "7d", "30d", "this_month", "custom"];
export type KpiKey = "bookings" | "booking_value" | "new_users" | "average_rating";

export interface OverviewAttention {
  verificationsWaiting: number;
  oldestVerificationWaitingHours: number | null;
  bookingsNoReply: number;
  disputesOpen: number;
  academicRequestsPending: number;
  reviewsReported: number;
  servicesReported: number;
}
export interface Kpi {
  key: KpiKey;
  value: string | null;
  previousValue: string | null;
  deltaPercent: number | null;
}
export interface BookingsPerDay {
  date: string;
  requests: number;
  completed: number;
}
export interface BookingsByStatus {
  status: BookingStatus;
  count: number;
  percent: number;
}
export interface LatestBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  client: { id: string; fullName: string };
  provider: { id: string; fullName: string; businessName: string | null };
  titleEn: string;
  titleAr: string;
  eventDate: string;
  total: string;
  createdAt: string;
}
export interface RecentActivity {
  id: string;
  action: string;
  actor: { id: string; fullName: string; role: "client" | "provider" | "academic" | "admin" | null } | null;
  objectType: string;
  objectId: string | null;
  objectLabel: string | null;
  href: string | null;
  logHref: string;
  level: "info" | "normal" | "sensitive" | "security";
  createdAt: string;
}
export interface Overview {
  range: OverviewRange;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  attention: OverviewAttention;
  kpis: Kpi[];
  bookingsPerDay: BookingsPerDay[];
  bookingsByStatus: BookingsByStatus[];
  latestBookings: LatestBooking[];
  recentActivity: RecentActivity[];
  generatedAt: string;
}
export interface NavCounts {
  verificationsWaiting: number;
  bookingsNoReply: number;
  disputesOpen: number;
  academicRequestsPending: number;
  reviewsReported: number;
  messagesReported: number;
  messagesUnread: number;
}

export type SearchScope = "all" | "users" | "services" | "bookings" | "requests" | "disputes" | "pages";
export type SearchGroupType = Exclude<SearchScope, "all">;
export const SEARCH_SCOPES: SearchScope[] = ["all", "users", "services", "bookings", "requests", "pages"];
export interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  badge: string | null;
}
export interface SearchGroup {
  type: SearchGroupType;
  items: SearchItem[];
}
export interface SearchResult {
  q: string;
  exactMatch: {
    type: "user" | "booking" | "academic_request" | "dispute" | "invoice";
    id: string;
    href: string;
  } | null;
  groups: SearchGroup[];
}

export const overviewKeys = {
  all: ["overview"] as const,
  detail: (q: QueryParams) => [...overviewKeys.all, q] as const,
  navCounts: () => ["nav-counts"] as const,
  search: (q: string, scope: SearchScope) => ["search", scope, q] as const,
};

/** URL state (`range`, `from`, `to`) → `GET /admin/overview` query. Custom without both days falls back to 30d. */
export function overviewQuery(
  range: string | null | undefined,
  from?: string | null,
  to?: string | null,
): QueryParams {
  const r = OVERVIEW_RANGES.includes(range as OverviewRange) ? (range as OverviewRange) : "30d";
  if (r === "custom") {
    return from && to ? { range: "custom", from, to } : { range: "30d" };
  }
  return { range: r };
}

export async function getOverview(query: QueryParams): Promise<Overview> {
  return (await api.get<DataResponse<Overview>>("/admin/overview", { query })).data;
}
export async function getNavCounts(): Promise<NavCounts> {
  return (await api.get<DataResponse<NavCounts>>("/admin/nav-counts")).data;
}
export async function search(
  q: string,
  scope: SearchScope = "all",
  limit = 5,
  signal?: AbortSignal,
): Promise<SearchResult> {
  return (
    await api.get<DataResponse<SearchResult>>("/admin/search", {
      query: { q, scope: scope === "all" ? undefined : scope, limit },
      signal,
    })
  ).data;
}
