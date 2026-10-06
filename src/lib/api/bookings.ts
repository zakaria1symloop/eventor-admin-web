/**
 * Module 8 — bookings & invoices (BKG-01 … BKG-07).
 * `GET/POST /admin/bookings`, `GET/PATCH /admin/bookings/:id`, status, reschedule (+ cancel proposal), price,
 * remind, invoice (JSON, PDF, send).
 */
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, apiFetch, buildUrl, type DataResponse, type ListMeta, type QueryParams } from "./client";
import { toApiError } from "./errors";
import type { EventType } from "./packs";
import { tokenStore } from "./token";
import type { PersonRef, WilayaRef } from "./users";

export type BookingStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";
export type BookingTab = "all" | "pending" | "accepted" | "completed" | "declined" | "cancelled" | "disputed";
export type BookingDisputeStatus = "none" | "open" | "resolved";
export type BookingSource = "android" | "ios" | "web" | "dashboard";
export type BookingLineKind = "service" | "extra" | "pack_service" | "discount" | "adjustment";
export type RescheduleStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type StatusAction = "accepted" | "declined" | "cancelled" | "completed" | "reopen";
export type PartyRole = "client" | "provider" | "admin";
export type MessageKind = "text" | "attachment" | "system";
export type MessageStatus = "visible" | "hidden" | "deleted";

export const BOOKING_TABS: BookingTab[] = [
  "all",
  "pending",
  "accepted",
  "completed",
  "declined",
  "cancelled",
  "disputed",
];
export const BOOKING_SOURCES: BookingSource[] = ["android", "ios", "web", "dashboard"];
export const LINE_KINDS: BookingLineKind[] = ["service", "extra", "pack_service", "discount", "adjustment"];

/** Reason codes offered by BKG-04 per action (free text is accepted by the API, max 60). */
export const STATUS_REASONS: Record<StatusAction, string[]> = {
  accepted: ["confirmed_by_phone", "provider_request", "other"],
  declined: [
    "provider_unavailable",
    "provider_request",
    "outside_service_area",
    "price_disagreement",
    "other",
  ],
  cancelled: [
    "client_request",
    "provider_request",
    "event_cancelled",
    "duplicate_booking",
    "no_agreement",
    "other",
  ],
  completed: ["event_took_place", "confirmed_by_both", "other"],
  reopen: ["completed_by_mistake", "dispute_raised", "other"],
};
export const RESCHEDULE_REASONS = [
  "client_request",
  "provider_request",
  "venue_change",
  "weather",
  "other",
] as const;

export interface BookingServiceRef {
  id: string;
  titleEn: string;
  titleAr: string;
}
export interface BookingPackRef {
  id: string;
  nameEn: string;
  nameAr: string;
}
export interface BookingClientRef {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}
export interface BookingProviderRef {
  id: string;
  fullName: string;
  businessName: string | null;
}

export interface BookingRow {
  id: string;
  reference: string;
  service: BookingServiceRef | null;
  pack: BookingPackRef | null;
  client: BookingClientRef;
  provider: BookingProviderRef;
  eventDate: string;
  /** Last day of a multi-day booking (per-day services); null for one day. */
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  eventType: EventType;
  wilaya: WilayaRef;
  guests: number | null;
  total: string;
  status: BookingStatus;
  disputeStatus: BookingDisputeStatus;
  noReply: boolean;
  respondedAt: string | null;
  createdAt: string;
  source: BookingSource;
}

export interface BookingTabCounts {
  all: number;
  pending: number;
  accepted: number;
  completed: number;
  declined: number;
  cancelled: number;
  disputed: number;
  noReply: number;
}

export interface BookingList {
  data: BookingRow[];
  meta: ListMeta & { counts: BookingTabCounts };
}

/* ------------------------------------------------------------------ detail */

export interface BookingClientCard extends BookingClientRef {
  email: string;
  phone: string | null;
  bookingsCount: number;
  status: string;
}
export interface BookingProviderCard extends BookingProviderRef {
  avatarUrl: string | null;
  email: string;
  phone: string | null;
  rating: number;
  ratingCount: number;
  avgReplyMinutes: number | null;
  replyRate: number | null;
  completedBookingsCount: number;
  acceptingBookings: boolean;
  status: string;
}
export interface BookingOffer {
  kind: "service" | "pack";
  id: string;
  titleEn: string;
  titleAr: string;
  coverUrl: string | null;
  priceType: string | null;
  basePrice: string;
  cancellationPolicyEn: string | null;
  cancellationPolicyAr: string | null;
}
export interface BookingCommune {
  id: string;
  name: string;
  nameAr: string;
}
export interface BookingLine {
  id: string;
  kind: BookingLineKind;
  label: string;
  quantity: number;
  unitAmount: string;
  amount: string;
  serviceId: string | null;
  position: number;
}
export interface BookingTimelineEntry {
  type: "status" | "reschedule" | "price";
  at: string;
  actor: PersonRef | null;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
  reason: string | null;
  note: string | null;
  notified: boolean | null;
  oldDate: string | null;
  newDate: string | null;
  rescheduleStatus: RescheduleStatus | null;
  oldTotal: string | null;
  newTotal: string | null;
}
export interface Reschedule {
  id: string;
  oldDate: string;
  oldStart: string | null;
  oldEnd: string | null;
  newDate: string;
  newStart: string | null;
  newEnd: string | null;
  proposedBy: PersonRef;
  reason: string | null;
  forced: boolean;
  status: RescheduleStatus;
  createdAt: string;
  resolvedAt: string | null;
}
export interface InvoiceSummary {
  id: string;
  number: string;
  version: number;
  issuedAt: string;
  total: string;
  pdfReady: boolean;
  sentToClientAt: string | null;
}
export interface BookingMessage {
  id: string;
  kind: MessageKind;
  senderLabel: string;
  body: string | null;
  bodyMasked: string | null;
  status: MessageStatus;
  createdAt: string;
}
export interface BookingConversation {
  id: string;
  kind: "direct" | "support" | "dispute";
  lastMessages: BookingMessage[];
}
export interface BookingDisputeSummary {
  id: string;
  reference: string;
  status: "open" | "in_review" | "resolved" | "closed";
  type: string;
  openedByRole: PartyRole;
  createdAt: string;
}
export interface AllowedTransition {
  action: StatusAction;
  to: BookingStatus;
  reasonRequired: boolean;
  warning: "event_not_passed" | "dispute_open" | null;
}
export interface BookingHistoryEntry {
  id: string;
  action: string;
  actor: PersonRef | null;
  level: "info" | "normal" | "sensitive" | "security";
  changes: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
}
export interface BookingAcademicRef {
  id: string;
  reference: string;
  title: string;
}

export interface BookingDetail extends Omit<BookingRow, "client" | "provider"> {
  client: BookingClientCard;
  provider: BookingProviderCard;
  offer: BookingOffer;
  locationText: string | null;
  commune: BookingCommune | null;
  clientNote: string | null;
  lines: BookingLine[];
  subtotal: string;
  discountTotal: string;
  feePercent: string;
  feeAmount: string;
  providerAmount: string;
  declineReason: string | null;
  cancelledBy: PartyRole | null;
  cancelReason: string | null;
  reminderSentAt: string | null;
  completedAt: string | null;
  reviewRequestedAt: string | null;
  replyDeadlineAt: string | null;
  createdBy: PersonRef | null;
  academicRequest: BookingAcademicRef | null;
  timeline: BookingTimelineEntry[];
  pendingReschedule: Reschedule | null;
  invoice: InvoiceSummary | null;
  conversation: BookingConversation | null;
  dispute: BookingDisputeSummary | null;
  allowedTransitions: AllowedTransition[];
  history: BookingHistoryEntry[];
  updatedAt: string;
}

export interface InvoiceLine {
  kind: BookingLineKind;
  label: string;
  quantity: number;
  unitAmount: string;
  amount: string;
}
export interface InvoiceIssuer {
  name: string;
  address: string;
  nif: string;
  rc: string;
  email: string;
  phone: string;
}
export interface InvoiceParty {
  id: string;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
}
export interface Invoice {
  id: string;
  bookingId: string;
  bookingReference: string;
  number: string;
  version: number;
  issuedAt: string;
  currency: string;
  issuer: InvoiceIssuer;
  client: InvoiceParty;
  provider: InvoiceParty;
  titleEn: string;
  titleAr: string;
  eventDate: string;
  eventType: EventType;
  lines: InvoiceLine[];
  subtotal: string;
  discountTotal: string;
  total: string;
  feePercent: string;
  feeAmount: string;
  providerAmount: string;
  pdfReady: boolean;
  sentToClientAt: string | null;
  versions: number[];
}

export interface RemindResult {
  id: string;
  reminderSentAt: string;
  nextReminderAt: string;
}

/* ------------------------------------------------------------------ bodies */

export interface CreateBookingBody {
  clientId: string;
  serviceId?: string;
  packId?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  eventType: EventType;
  wilayaCode: number;
  communeId?: string;
  locationText?: string | null;
  guests?: number;
  clientNote?: string | null;
  extras?: { extraId: string; quantity: number }[];
  academicRequestId?: string;
}
export interface ChangeStatusBody {
  status: StatusAction;
  reason?: string;
  note: string;
  notify: boolean;
  cancelledBy?: PartyRole;
}
export interface RescheduleBody {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason: string;
  force?: boolean;
}
export interface PriceLineInput {
  kind: BookingLineKind;
  label: string;
  quantity: number;
  unitAmount: string;
  serviceId?: string;
}
export interface ChangePriceBody {
  lines: PriceLineInput[];
  reason: string;
}
export interface UpdateBookingBody {
  eventType?: EventType;
  startTime?: string | null;
  endTime?: string | null;
  locationText?: string | null;
  communeId?: string | null;
  wilayaCode?: number;
  guests?: number | null;
  clientNote?: string | null;
}

/* ------------------------------------------------------------------ keys + queries */

export const bookingKeys = {
  all: ["bookings"] as const,
  detail: (id: string) => [...bookingKeys.all, "detail", id] as const,
  invoice: (id: string) => [...bookingKeys.all, "invoice", id] as const,
  noReplyCount: () => [...bookingKeys.all, "no-reply-count"] as const,
};

/**
 * DataList URL params → `GET /admin/bookings` query. URL keys follow the links other screens build:
 * `client`, `provider`, `service`, `pack`, `status` (→ tab when no tab is set), `academicRequest`.
 */
export function bookingsQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const eventDate = parseRange(f.eventDate);
  const created = parseRange(f.created);
  const amount = parseRange(f.amount);
  const tab = p.tab && p.tab !== "all" ? p.tab : one("status");
  return {
    tab: tab && tab !== "all" ? tab : undefined,
    q: p.q || undefined,
    noReply: one("noReply") === "true" ? true : undefined,
    clientId: one("client"),
    providerId: one("provider"),
    serviceId: one("service"),
    packId: one("pack"),
    categoryId: one("categoryId"),
    academicRequestId: one("academicRequest"),
    wilaya: list("wilaya"),
    eventDateFrom: eventDate.from || undefined,
    eventDateTo: eventDate.to || undefined,
    createdFrom: created.from || undefined,
    createdTo: created.to || undefined,
    amountMin: amount.from || undefined,
    amountMax: amount.to || undefined,
    source: one("source"),
    disputeStatus: one("disputeStatus"),
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listBookings(query: QueryParams): Promise<BookingList> {
  return api.get<BookingList>("/admin/bookings", { query });
}

export async function getBooking(id: string): Promise<BookingDetail> {
  return (await api.get<DataResponse<BookingDetail>>(`/admin/bookings/${id}`)).data;
}

export async function createBooking(body: CreateBookingBody): Promise<BookingDetail> {
  return (await api.post<DataResponse<BookingDetail>>("/admin/bookings", body)).data;
}

export async function updateBooking(id: string, body: UpdateBookingBody): Promise<BookingDetail> {
  return (await api.patch<DataResponse<BookingDetail>>(`/admin/bookings/${id}`, body)).data;
}

export async function changeBookingStatus(id: string, body: ChangeStatusBody): Promise<BookingDetail> {
  return (await api.post<DataResponse<BookingDetail>>(`/admin/bookings/${id}/status`, body)).data;
}

export async function rescheduleBooking(id: string, body: RescheduleBody): Promise<BookingDetail> {
  return (await api.post<DataResponse<BookingDetail>>(`/admin/bookings/${id}/reschedule`, body)).data;
}

export async function cancelReschedule(id: string, rescheduleId: string): Promise<BookingDetail> {
  return (
    await api.post<DataResponse<BookingDetail>>(`/admin/bookings/${id}/reschedules/${rescheduleId}/cancel`)
  ).data;
}

export async function changeBookingPrice(id: string, body: ChangePriceBody): Promise<BookingDetail> {
  return (await api.patch<DataResponse<BookingDetail>>(`/admin/bookings/${id}/price`, body)).data;
}

export async function remindProvider(id: string): Promise<RemindResult> {
  return (await api.post<DataResponse<RemindResult>>(`/admin/bookings/${id}/remind`)).data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  return (await api.get<DataResponse<Invoice>>(`/admin/bookings/${id}/invoice`)).data;
}

export async function sendInvoice(id: string): Promise<Invoice> {
  return (await api.post<DataResponse<Invoice>>(`/admin/bookings/${id}/invoice/send`)).data;
}

/** Fetches the PDF with the bearer token (a plain link can't send it) and opens / saves it. */
export async function downloadInvoicePdf(id: string, fileName: string) {
  const doFetch = () =>
    fetch(buildUrl(`/admin/bookings/${id}/invoice.pdf`), {
      credentials: "include",
      headers: { Authorization: `Bearer ${tokenStore.get() ?? ""}`, Accept: "application/pdf" },
    });
  let res = await doFetch();
  if (res.status === 401) {
    // let the JSON client refresh the token once, then retry
    await apiFetch(`/admin/bookings/${id}/invoice`).catch(() => undefined);
    res = await doFetch();
  }
  if (!res.ok) throw await toApiError(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ------------------------------------------------------------------ money helpers (mirror the API policy) */

const toCents = (v: string | number) => Math.round(Number(v) * 100);
const fromCents = (c: number) => {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};

/** Line amount: discount always negative, adjustment keeps its sign, other kinds positive. */
export function lineAmount(kind: BookingLineKind, quantity: number, unitAmount: string | number): number {
  const raw = toCents(unitAmount || 0) * (quantity || 0);
  const cents = kind === "discount" ? -Math.abs(raw) : kind === "adjustment" ? raw : Math.abs(raw);
  return cents / 100;
}

/** Totals + Eventor fee for a set of lines (BKG-06 live summary, create form). */
export function priceTotals(
  lines: { kind: BookingLineKind; quantity: number; unitAmount: string | number }[],
  feePercent: string | number,
) {
  let positive = 0;
  let negative = 0;
  for (const l of lines) {
    const c = Math.round(lineAmount(l.kind, l.quantity, l.unitAmount) * 100);
    if (c >= 0) positive += c;
    else negative -= c;
  }
  const total = positive - negative;
  const fee = Math.round((total * Number(feePercent || 0)) / 100);
  return {
    subtotal: fromCents(positive),
    discountTotal: fromCents(negative),
    total: fromCents(total),
    feeAmount: fromCents(fee),
    providerAmount: fromCents(total - fee),
    negative: total < 0,
  };
}

export function offerTitle(
  b: { service: BookingServiceRef | null; pack: BookingPackRef | null },
  locale: string,
): string {
  if (b.service) return locale === "ar" ? b.service.titleAr || b.service.titleEn : b.service.titleEn;
  if (b.pack) return locale === "ar" ? b.pack.nameAr || b.pack.nameEn : b.pack.nameEn;
  return "—";
}

/** Status actions allowed from a row status (same rules as the API; the detail uses `allowedTransitions`). */
export function rowTransitions(status: BookingStatus): StatusAction[] {
  switch (status) {
    case "pending":
      return ["accepted", "declined", "cancelled"];
    case "accepted":
      return ["cancelled", "completed"];
    case "completed":
      return ["reopen"];
    default:
      return [];
  }
}

export const isEditable = (status: BookingStatus) => status === "pending" || status === "accepted";

/** BKG-03 "Open dispute": accepted, completed or cancelled bookings without an open dispute (DSP-01 rules). */
export const canOpenDispute = (b: { status: BookingStatus; disputeStatus: BookingDisputeStatus }) =>
  (b.status === "accepted" || b.status === "completed" || b.status === "cancelled") && b.disputeStatus !== "open";
