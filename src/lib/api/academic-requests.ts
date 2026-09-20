/**
 * Module 10 — academic requests (ACR-01 … ACR-04).
 * `GET /admin/academic-requests`, `GET /:id`, assign, request-changes, approve, reject, cancel,
 * proposals (add / remove / book). Live: socket `academic_request:new|updated`.
 */
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import type { BookingStatus } from "./bookings";
import type { EventType } from "./packs";
import type { CategoryRef, PersonRef, WilayaRef } from "./users";

export type RequestStatus =
  "pending" | "changes_requested" | "approved" | "in_progress" | "rejected" | "completed" | "cancelled";
export type RequestTab = RequestStatus | "all";
export type RequestAction =
  | "assign"
  | "request_changes"
  | "approve"
  | "reject"
  | "cancel"
  | "propose"
  | "book"
  | "resubmit"
  | "complete";

export const REQUEST_TABS: RequestTab[] = [
  "all",
  "pending",
  "changes_requested",
  "approved",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
];
export const REJECT_REASONS = [
  "missing_authorisation",
  "date_too_close",
  "budget_mismatch",
  "out_of_scope",
  "other",
] as const;
export const CANCEL_REASONS = ["requester_withdrew", "event_cancelled", "duplicate", "other"] as const;

export interface RequestTabCounts {
  all: number;
  pending: number;
  changes_requested: number;
  approved: number;
  in_progress: number;
  rejected: number;
  completed: number;
  cancelled: number;
}
export interface Requester {
  name: string;
  email: string;
  phone: string;
  userId: string | null;
}
export interface RequestFormRef {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
  versionId: string;
  version: number;
}
export interface RequestRow {
  id: string;
  reference: string;
  title: string;
  institutionName: string | null;
  requester: Requester;
  eventType: EventType | null;
  eventDate: string | null;
  wilaya: WilayaRef | null;
  attendees: number | null;
  budgetMin: string | null;
  budgetMax: string | null;
  form: RequestFormRef;
  status: RequestStatus;
  assignedAdmin: PersonRef | null;
  proposalsCount: number;
  bookingsCount: number;
  submittedAt: string;
}
export interface RequestList {
  data: RequestRow[];
  meta: ListMeta & { counts: RequestTabCounts };
}

export interface RenderedAnswer {
  key: string;
  type: string;
  labelEn: string;
  labelAr: string;
  section: string | null;
  value: unknown;
  displayValue: string | null;
  changed: boolean;
}
export interface Attachment {
  id: string;
  fileId: string;
  fieldKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}
export interface Need {
  category: CategoryRef;
  note: string | null;
}
export interface ProposalService {
  id: string;
  titleEn: string;
  titleAr: string;
  basePrice: string;
  priceType: string;
  status: string;
  provider: PersonRef;
  businessName: string | null;
  category: CategoryRef;
}
export interface RequestBookingRef {
  id: string;
  reference: string;
  status: BookingStatus;
  eventDate: string;
  total: string;
  titleEn: string | null;
  provider: PersonRef;
}
export interface Proposal {
  id: string;
  service: ProposalService;
  note: string | null;
  proposedBy: PersonRef | null;
  booking: RequestBookingRef | null;
  createdAt: string;
}
export interface RequestedChanges {
  fields: string[];
  message: string;
  requestedAt: string;
  requestedBy: PersonRef | null;
  linkExpiresAt: string | null;
  resubmittedAt: string | null;
}
export interface RequestTimelineEntry {
  id: string;
  action: string;
  actor: PersonRef | null;
  changes: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
}
export interface RequestDetail extends RequestRow {
  answers: RenderedAnswer[];
  attachments: Attachment[];
  needs: Need[];
  proposals: Proposal[];
  bookings: RequestBookingRef[];
  requestedChanges: RequestedChanges | null;
  changedFields: string[];
  decisionMessage: string | null;
  rejectReason: string | null;
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  allowedActions: RequestAction[];
  timeline: RequestTimelineEntry[];
  updatedAt: string;
}

export interface RequestChangesBody {
  fields: string[];
  message: string;
}
export interface ApproveRequestBody {
  message?: string | null;
  serviceIds?: string[];
}
export interface RejectRequestBody {
  reason: string;
  message: string;
}
export interface CancelRequestBody {
  reason: string;
}
export interface CreateProposalBody {
  serviceId: string;
  note?: string | null;
}
export interface BookProposalBody {
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  guests?: number;
  notes?: string;
}

export const requestKeys = {
  all: ["academic-requests"] as const,
  detail: (id: string) => [...requestKeys.all, "detail", id] as const,
  badge: () => [...requestKeys.all, "badge"] as const,
};

export function requestsQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const eventDate = parseRange(f.eventDate);
  // `status` (quick cards) wins over the tab.
  const tab = one("status") ?? p.tab;
  return {
    tab: tab && tab !== "all" ? tab : undefined,
    q: p.q || undefined,
    formId: one("formId"),
    wilaya: list("wilaya"),
    eventDateFrom: eventDate.from || undefined,
    eventDateTo: eventDate.to || undefined,
    assignedAdminId: one("assignedAdminId"),
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listRequests(query: QueryParams): Promise<RequestList> {
  return api.get<RequestList>("/admin/academic-requests", { query });
}
export async function getRequest(id: string): Promise<RequestDetail> {
  return (await api.get<DataResponse<RequestDetail>>(`/admin/academic-requests/${id}`)).data;
}
const post = async <B>(id: string, action: string, body?: B) =>
  (await api.post<DataResponse<RequestDetail>>(`/admin/academic-requests/${id}/${action}`, body ?? {})).data;

export const assignRequest = (id: string, adminId?: string) => post(id, "assign", adminId ? { adminId } : {});
export const requestChanges = (id: string, body: RequestChangesBody) => post(id, "request-changes", body);
export const approveRequest = (id: string, body: ApproveRequestBody) => post(id, "approve", body);
export const rejectRequest = (id: string, body: RejectRequestBody) => post(id, "reject", body);
export const cancelRequest = (id: string, body: CancelRequestBody) => post(id, "cancel", body);
export const addProposal = (id: string, body: CreateProposalBody) => post(id, "proposals", body);
export const bookProposal = (id: string, proposalId: string, body: BookProposalBody) =>
  post(id, `proposals/${proposalId}/book`, body);
export async function removeProposal(id: string, proposalId: string): Promise<RequestDetail> {
  return (
    await api.delete<DataResponse<RequestDetail>>(`/admin/academic-requests/${id}/proposals/${proposalId}`)
  ).data;
}

/** Status actions allowed from a row status (same rules as `academic.policy.ts`). */
export function rowRequestActions(status: RequestStatus): RequestAction[] {
  const open = ["pending", "changes_requested", "approved", "in_progress"].includes(status);
  const out: RequestAction[] = [];
  if (open) out.push("assign");
  if (status === "pending") out.push("request_changes", "approve");
  if (status === "pending" || status === "changes_requested") out.push("reject");
  if (open) out.push("cancel", "propose");
  if (status === "approved" || status === "in_progress") out.push("book");
  return out;
}

/**
 * ACR-04 checklist: the input fields of the request's form version, in form order
 * (section and info fields are not answers and can't be asked for).
 */
export function changeableFields(answers: Pick<RenderedAnswer, "key" | "type" | "labelEn" | "labelAr">[]) {
  return answers.filter((a) => a.type !== "section" && a.type !== "info");
}

/** Newly booked proposal → its booking (to navigate after "Create booking"). */
export function bookedProposal(detail: RequestDetail, proposalId: string) {
  return detail.proposals.find((p) => p.id === proposalId)?.booking ?? null;
}
