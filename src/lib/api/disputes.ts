/**
 * Module 9 — disputes (DSP-01 … DSP-03).
 * `GET/POST /admin/disputes`, `GET /admin/disputes/:id`, assign, evidence (multipart), messages,
 * request-evidence, resolve, close. Live: socket `dispute:new` on `/admin`.
 */
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import type { BookingDisputeStatus, BookingStatus } from "./bookings";
import type { AdminMessage } from "./messaging";
import type { PersonRef } from "./users";

export type DisputeStatus = "open" | "in_review" | "resolved" | "closed";
export type DisputeTab = DisputeStatus | "all";
export type DisputeType =
  | "provider_no_show"
  | "client_no_show"
  | "service_not_as_described"
  | "incomplete_or_late"
  | "price_disagreement"
  | "cancellation_disagreement"
  | "damage_or_safety"
  | "behaviour"
  | "other";
export type DisputePartyRole = "client" | "provider" | "admin";
export type DisputeOutcome = "completed" | "cancelled" | "unchanged";
export type DisputeAction = "assign" | "message" | "request_evidence" | "add_evidence" | "resolve" | "close";
export type EvidenceKind = "file" | "chat_snapshot" | "note";

export const DISPUTE_TABS: DisputeTab[] = ["open", "in_review", "resolved", "closed", "all"];
export const DISPUTE_TYPES: DisputeType[] = [
  "provider_no_show",
  "client_no_show",
  "service_not_as_described",
  "incomplete_or_late",
  "price_disagreement",
  "cancellation_disagreement",
  "damage_or_safety",
  "behaviour",
  "other",
];
export const DISPUTE_OUTCOMES: DisputeOutcome[] = ["cancelled", "completed", "unchanged"];
/** Booking statuses a dispute can be opened on (422 BOOKING_NOT_DISPUTABLE otherwise). */
export const DISPUTABLE_BOOKING_STATUSES: BookingStatus[] = ["accepted", "completed", "cancelled"];

export interface DisputeTabCounts {
  open: number;
  inReview: number;
  resolved: number;
  closed: number;
  all: number;
  /** Resolved / closed in the last 30 days (by `resolvedAt`). */
  resolved30d: number;
  closed30d: number;
}
export interface DisputePartyRef {
  id: string;
  fullName: string;
  role: DisputePartyRole;
}
export interface DisputeBookingRef {
  id: string;
  reference: string;
  titleEn: string;
  titleAr: string;
  eventDate: string;
}
export interface DisputeRow {
  id: string;
  reference: string;
  type: DisputeType;
  booking: DisputeBookingRef;
  openedBy: DisputePartyRef;
  against: DisputePartyRef;
  assignedAdmin: PersonRef | null;
  status: DisputeStatus;
  evidenceCount: number;
  lastActivityAt: string;
  createdAt: string;
}
export interface DisputeList {
  data: DisputeRow[];
  meta: ListMeta & { counts: DisputeTabCounts };
}

export interface DisputePartyHistory {
  disputesCount: number;
  cancellationsCount: number;
  ratingAvg: number | null;
}
export interface DisputeResponse {
  id: string;
  body: string;
  createdAt: string;
}
export interface DisputeSide {
  id: string;
  fullName: string;
  role: DisputePartyRole;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  businessName: string | null;
  isOpener: boolean;
  description: string | null;
  responses: DisputeResponse[];
  evidenceCount: number;
  history: DisputePartyHistory;
}
export interface EvidenceFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}
export interface DisputeEvidence {
  id: string;
  kind: EvidenceKind;
  uploadedBy: DisputePartyRef;
  file: EvidenceFile | null;
  conversationId: string | null;
  note: string | null;
  createdAt: string;
}
export interface DisputeBookingCard extends DisputeBookingRef {
  status: BookingStatus;
  disputeStatus: BookingDisputeStatus;
  kind: "service" | "pack";
  startTime: string | null;
  endTime: string | null;
  subtotal: string;
  discountTotal: string;
  total: string;
  invoiceNumber: string | null;
  cancelledBy: DisputePartyRole | null;
  cancelReason: string | null;
  completedAt: string | null;
}
export interface DisputeTimelineEntry {
  id: string;
  type: string;
  actor: PersonRef | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}
export interface DisputeDetail {
  id: string;
  reference: string;
  type: DisputeType;
  status: DisputeStatus;
  description: string;
  openedBy: DisputePartyRef;
  against: DisputePartyRef;
  sides: { client: DisputeSide; provider: DisputeSide };
  evidence: DisputeEvidence[];
  booking: DisputeBookingCard;
  assignedAdmin: PersonRef | null;
  conversationId: string;
  conversationStatus: "open" | "closed";
  bookingOutcome: DisputeOutcome | null;
  decisionNote: string | null;
  resolvedBy: PersonRef | null;
  resolvedAt: string | null;
  timeline: DisputeTimelineEntry[];
  allowedActions: DisputeAction[];
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenDisputeBody {
  bookingId: string;
  openedByRole: "client" | "provider";
  type: DisputeType;
  description: string;
  evidenceFileIds?: string[];
  ignoreWindow?: boolean;
  note?: string;
}
export interface AssignDisputeBody {
  adminId?: string;
}
export interface RequestEvidenceBody {
  fromUserId: string;
  message: string;
}
export interface ResolveDisputeBody {
  bookingOutcome: DisputeOutcome;
  decisionNote: string;
}
export interface CloseDisputeBody {
  note: string;
}

export const disputeKeys = {
  all: ["disputes"] as const,
  detail: (id: string) => [...disputeKeys.all, "detail", id] as const,
  badge: () => [...disputeKeys.all, "badge"] as const,
};

export const isActiveDispute = (s: DisputeStatus) => s === "open" || s === "in_review";

/** DataList URL params → `GET /admin/disputes` query (`userId`/`bookingId` come from profile / booking links). */
export function disputesQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const created = parseRange(f.created);
  // `status` (quick cards) wins over the tab.
  const tab = one("status") ?? p.tab;
  return {
    tab: tab && tab !== "all" ? tab : undefined,
    q: p.q || undefined,
    type: list("type"),
    openedByRole: one("openedByRole"),
    assignedAdminId: one("assignedAdminId"),
    bookingId: one("bookingId"),
    bookingStatus: list("bookingStatus"),
    userId: one("userId"),
    createdFrom: created.from || undefined,
    createdTo: created.to || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listDisputes(query: QueryParams): Promise<DisputeList> {
  return api.get<DisputeList>("/admin/disputes", { query });
}
export async function getDispute(id: string): Promise<DisputeDetail> {
  return (await api.get<DataResponse<DisputeDetail>>(`/admin/disputes/${id}`)).data;
}
export async function openDispute(body: OpenDisputeBody): Promise<DisputeDetail> {
  return (await api.post<DataResponse<DisputeDetail>>("/admin/disputes", body)).data;
}
export async function assignDispute(id: string, body: AssignDisputeBody = {}): Promise<DisputeDetail> {
  return (await api.post<DataResponse<DisputeDetail>>(`/admin/disputes/${id}/assign`, body)).data;
}
export async function addEvidence(
  id: string,
  input: { file: File; partyUserId: string; note?: string },
): Promise<DisputeDetail> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("partyUserId", input.partyUserId);
  if (input.note) form.append("note", input.note);
  return (await api.post<DataResponse<DisputeDetail>>(`/admin/disputes/${id}/evidence`, form)).data;
}
export async function sendDisputeMessage(id: string, body: string): Promise<AdminMessage> {
  return (await api.post<DataResponse<AdminMessage>>(`/admin/disputes/${id}/messages`, { body })).data;
}
export async function requestEvidence(id: string, body: RequestEvidenceBody): Promise<DisputeDetail> {
  return (await api.post<DataResponse<DisputeDetail>>(`/admin/disputes/${id}/request-evidence`, body)).data;
}
export async function resolveDispute(id: string, body: ResolveDisputeBody): Promise<DisputeDetail> {
  return (await api.post<DataResponse<DisputeDetail>>(`/admin/disputes/${id}/resolve`, body)).data;
}
export async function closeDispute(id: string, body: CloseDisputeBody): Promise<DisputeDetail> {
  return (await api.post<DataResponse<DisputeDetail>>(`/admin/disputes/${id}/close`, body)).data;
}

/**
 * DSP-03: whether a booking outcome can be applied to a booking status (same rules as the API's
 * `outcomeActions`): completed is refused on a cancelled booking; cancelled and unchanged always apply.
 */
export function outcomeAllowed(outcome: DisputeOutcome, bookingStatus: BookingStatus): boolean {
  if (outcome === "unchanged") return true;
  if (outcome === "completed") return bookingStatus === "accepted" || bookingStatus === "completed";
  return bookingStatus === "accepted" || bookingStatus === "completed" || bookingStatus === "cancelled";
}

/** What the booking becomes (for the radio card hint). `null` = no change. */
export function outcomeResult(outcome: DisputeOutcome, bookingStatus: BookingStatus): BookingStatus | null {
  if (outcome === "unchanged") return null;
  if (outcome === "completed") return bookingStatus === "completed" ? null : "completed";
  return bookingStatus === "cancelled" ? null : "cancelled";
}
