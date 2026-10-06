/**
 * Module 4 — users (USR-01 … USR-13).
 * `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id`, block / unblock / block-impact,
 * password-reset, sessions/revoke, bulk, notes.
 */
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";

export type UserRole = "client" | "provider" | "admin";
export type ManagedRole = "client" | "provider";
export type UserStatus = "active" | "blocked";
export type VerificationStatus = "not_required" | "pending" | "verified" | "rejected";
export type Language = "ar" | "en";
export type UserTab = "all" | "clients" | "providers" | "blocked" | "awaiting_verification";
export type LastActive = "7d" | "30d" | "90d" | "never";
export type BookingChoice = "cancel" | "keep";

export const USER_TABS: UserTab[] = ["all", "clients", "providers", "blocked", "awaiting_verification"];

export interface WilayaRef {
  code: number;
  name: string;
  nameAr: string;
}
export interface CategoryRef {
  id: string;
  nameEn: string;
  nameAr: string;
}
export interface PersonRef {
  id: string;
  fullName: string;
}

export interface UserRow {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  wilaya: WilayaRef | null;
  businessName: string | null;
  category: CategoryRef | null;
  rating: number | null;
  ratingCount: number | null;
  bookingsCount: number;
  servicesCount: number | null;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface UserTabCounts {
  all: number;
  clients: number;
  providers: number;
  blocked: number;
  awaiting_verification: number;
}

export interface UserList {
  data: UserRow[];
  meta: ListMeta & { counts: UserTabCounts };
}

/* ------------------------------------------------------------------ detail */

export type DocumentType = "national_id" | "commercial_register_or_artisan_card" | "tax_card";
export type DocumentStatus = "pending" | "approved" | "rejected";

export interface BookingStats {
  total: number;
  pending: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}
export interface UserStats {
  bookings: BookingStats;
  services: { total: number; published: number; hidden: number } | null;
  packs: { total: number; published: number } | null;
  reviews: { avg: number | null; count: number; reported: number };
  disputes: { open: number; total: number };
  earnings: string;
  replyRate: number | null;
}
export interface ProviderProfile {
  businessName: string;
  category: CategoryRef | null;
  bioEn: string | null;
  bioAr: string | null;
  languagesSpoken: string[] | null;
  yearsActive: number | null;
  acceptingBookings: boolean;
  avgRating: number;
  ratingCount: number;
  completedBookingsCount: number;
  replyRate: number | null;
  avgReplyMinutes: number | null;
  wilayas: WilayaRef[];
}
export interface DocumentsSummary {
  verificationStatus: VerificationStatus;
  items: { type: DocumentType; status: DocumentStatus | "missing" }[];
  progress: { approved: number; rejected: number; waiting: number; missing: number };
}
export interface BlockInfo {
  blockedAt: string;
  until: string | null;
  reason: string | null;
  message: string | null;
  blockedBy: PersonRef | null;
}
export interface RecentBooking {
  id: string;
  reference: string;
  status: string;
  eventDate: string;
  total: string;
  title: string | null;
  counterpart: PersonRef;
  createdAt: string;
}
export interface RecentService {
  id: string;
  titleEn: string;
  titleAr: string;
  status: string;
  basePrice: string;
  avgRating: number;
  bookingsCount: number;
}
export interface RecentReview {
  id: string;
  rating: number;
  comment: string;
  status: string;
  author: PersonRef;
  provider: PersonRef;
  createdAt: string;
}
export interface UserNote {
  id: string;
  body: string;
  author: PersonRef;
  canDelete: boolean;
  createdAt: string;
}
export interface UserDetail extends UserRow {
  language: Language;
  emailVerifiedAt: string | null;
  block: BlockInfo | null;
  provider: ProviderProfile | null;
  documents: DocumentsSummary | null;
  stats: UserStats;
  recent: {
    bookings: RecentBooking[];
    services: RecentService[];
    reviews: RecentReview[];
    notes: UserNote[];
  };
  updatedAt: string;
}

export interface BlockImpact {
  servicesCount: number;
  packsCount: number;
  pendingBookings: number;
  upcomingBookings: number;
  conversations: number;
}
export interface BlockResult {
  user: UserRow;
  impact: BlockImpact;
  cancelledBookings: number;
  sessionsRevoked: number;
}
export interface PasswordResetResult {
  mode: "link" | "temporary";
  temporaryPassword: string | null;
  sessionsRevoked: number;
}
export interface BulkItemResult {
  id: string;
  result: "ok";
  cancelledBookings: number;
  sessionsRevoked: number;
}
/** 409 BULK_ACTION_REFUSED details (all-or-nothing: nothing changed). */
export interface BulkRefusedDetails {
  refused: { id: string; code: string }[];
}

/** 409 ACCOUNT_HAS_ACTIVE_ITEMS details. */
export interface ActiveItemsDetails {
  upcomingBookings: number;
  openDisputes: number;
}

/* ------------------------------------------------------------------ bodies */

export interface CreateUserBody {
  role: ManagedRole;
  fullName: string;
  email: string;
  phone: string;
  language: Language;
  wilayaCode?: number;
  businessName?: string;
  categoryId?: string;
  wilayaCodes?: number[];
  skipVerification?: boolean;
}
export interface UpdateUserBody {
  fullName?: string;
  email?: string;
  phone?: string | null;
  reason?: string | null;
  language?: Language;
  wilayaCode?: number | null;
  businessName?: string;
  categoryId?: string;
  wilayaCodes?: number[];
}
export interface BlockBody {
  reason: string;
  until?: string | null;
  message?: string | null;
  bookings: BookingChoice;
}
export type BulkAction = "block" | "unblock" | "delete";
export interface BulkBody {
  action: BulkAction;
  ids: string[];
  reason?: string;
  bookings?: BookingChoice;
  message?: string | null;
}

/* ------------------------------------------------------------------ keys + calls */

export const userKeys = {
  all: ["users"] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
  impact: (id: string) => [...userKeys.all, "impact", id] as const,
  notes: (id: string) => [...userKeys.all, "notes", id] as const,
};

/** DataList URL params → `GET /admin/users` query. */
export function usersQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
) {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const joined = parseRange(f.joined);
  const bookings = parseRange(f.bookings);
  const query: QueryParams = {
    tab: p.tab && p.tab !== "all" ? p.tab : undefined,
    q: p.q || undefined,
    role: one("role"),
    status: one("status"),
    verificationStatus: one("verificationStatus"),
    wilaya: list("wilaya"),
    categoryId: one("categoryId"),
    minRating: one("minRating"),
    joinedFrom: joined.from || undefined,
    joinedTo: joined.to || undefined,
    minCompletedBookings: bookings.from || undefined,
    maxCompletedBookings: bookings.to || undefined,
    lastActive: one("lastActive"),
    language: one("language"),
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
  return query;
}

export function listUsers(query: QueryParams): Promise<UserList> {
  return api.get<UserList>("/admin/users", { query });
}

export async function getUser(id: string): Promise<UserDetail> {
  return (await api.get<DataResponse<UserDetail>>(`/admin/users/${id}`)).data;
}

export async function createUser(body: CreateUserBody): Promise<UserDetail> {
  return (await api.post<DataResponse<UserDetail>>("/admin/users", body)).data;
}

export async function updateUser(id: string, body: UpdateUserBody): Promise<UserDetail> {
  return (await api.patch<DataResponse<UserDetail>>(`/admin/users/${id}`, body)).data;
}

export async function getBlockImpact(id: string): Promise<BlockImpact> {
  return (await api.get<DataResponse<BlockImpact>>(`/admin/users/${id}/block-impact`)).data;
}

export async function blockUser(id: string, body: BlockBody): Promise<BlockResult> {
  return (await api.post<DataResponse<BlockResult>>(`/admin/users/${id}/block`, body)).data;
}

/** POST /admin/users/:id/avatar (multipart `file`): replace a client's or provider's photo. */
export async function replaceUserAvatar(id: string, file: File): Promise<UserDetail> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<DataResponse<UserDetail>>(`/admin/users/${id}/avatar`, form)).data;
}

/** DELETE /admin/users/:id/avatar `{ note? }`: remove it (e.g. inappropriate); the note goes to the activity log. */
export async function removeUserAvatar(id: string, note?: string): Promise<UserDetail> {
  return (await api.delete<DataResponse<UserDetail>>(`/admin/users/${id}/avatar`, { body: { note: note || undefined } })).data;
}

export async function unblockUser(id: string): Promise<UserDetail> {
  return (await api.post<DataResponse<UserDetail>>(`/admin/users/${id}/unblock`)).data;
}

export function deleteUser(id: string, typedName: string) {
  return api.delete<void>(`/admin/users/${id}`, { body: { typedName } });
}

export async function resetPassword(
  id: string,
  body: { mode: "link" | "temporary"; signOutEverywhere?: boolean },
): Promise<PasswordResetResult> {
  return (await api.post<DataResponse<PasswordResetResult>>(`/admin/users/${id}/password-reset`, body)).data;
}

export async function revokeSessions(id: string): Promise<{ sessionsRevoked: number }> {
  return (await api.post<DataResponse<{ sessionsRevoked: number }>>(`/admin/users/${id}/sessions/revoke`))
    .data;
}

export async function bulkUsers(body: BulkBody): Promise<BulkItemResult[]> {
  return (await api.post<DataResponse<BulkItemResult[]>>("/admin/users/bulk", body)).data;
}

export async function addNote(id: string, body: string): Promise<UserNote> {
  return (await api.post<DataResponse<UserNote>>(`/admin/users/${id}/notes`, { body })).data;
}

export function deleteNote(id: string, noteId: string) {
  return api.delete<void>(`/admin/users/${id}/notes/${noteId}`);
}
