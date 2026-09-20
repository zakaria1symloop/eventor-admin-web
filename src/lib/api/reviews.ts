/**
 * Module 12 — reviews, provider replies and reports (REV-01 … REV-03, MSG-01 report banner).
 * `GET /admin/reviews`, `GET/PATCH/DELETE /admin/reviews/:id`, `POST …/:id/moderate`,
 * `POST /admin/review-replies/:id/hide|show`, `DELETE /admin/review-replies/:id`,
 * `GET /admin/reports`, `POST /admin/reports/:id/resolve|dismiss|convert-to-dispute`,
 * `POST /admin/messages/:id/reports/dismiss`.
 */
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import type { BookingDisputeStatus, BookingStatus } from "./bookings";
import type { DisputeStatus, DisputeType } from "./disputes";
import type { PersonRef } from "./users";

export type ReviewStatus = "published" | "hidden" | "redacted";
export type ReviewTab = "all" | "published" | "reported" | "hidden" | "redacted";
export type ReviewFlag = "phone" | "email" | "link" | "handle" | "insult";
export type ReplyStatus = "published" | "hidden";
export type ModerationAction = "hide" | "show" | "redact" | "dismiss_reports";
export type ReviewAction = ModerationAction | "edit" | "delete" | "convert_report";
export type ReportTargetType = "review" | "review_reply" | "message" | "service" | "pack" | "user";
export type ReportReason = "inappropriate" | "spam" | "contact_outside" | "harassment" | "fake" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type ReportTab = ReportStatus | "all";
export type ReportResolveAction =
  | "content_hidden"
  | "content_redacted"
  | "content_deleted"
  | "chat_closed"
  | "user_warned"
  | "user_blocked"
  | "service_hidden"
  | "other";

export const REVIEW_TABS: ReviewTab[] = ["all", "published", "reported", "hidden", "redacted"];
export const REVIEW_FLAGS: ReviewFlag[] = ["phone", "email", "link", "handle", "insult"];
export const REPORT_TABS: ReportTab[] = ["open", "resolved", "dismissed", "all"];
export const REPORT_REASONS: ReportReason[] = [
  "inappropriate",
  "spam",
  "contact_outside",
  "harassment",
  "fake",
  "other",
];
export const REPORT_TARGET_TYPES: ReportTargetType[] = [
  "review",
  "review_reply",
  "message",
  "service",
  "pack",
  "user",
];

export interface ReviewTabCounts {
  all: number;
  published: number;
  reported: number;
  hidden: number;
  redacted: number;
}
export interface ReviewProviderRef extends PersonRef {
  businessName: string | null;
}
export interface ReviewServiceRef {
  id: string;
  titleEn: string;
  titleAr: string;
}
export interface ReviewPackRef {
  id: string;
  nameEn: string;
  nameAr: string;
}
export interface ReviewReplyRef {
  id: string;
  body: string;
  status: ReplyStatus;
}
export interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  redactedComment: string | null;
  status: ReviewStatus;
  author: PersonRef;
  provider: ReviewProviderRef;
  service: ReviewServiceRef | null;
  pack: ReviewPackRef | null;
  booking: { id: string; reference: string };
  hadDispute: boolean;
  detectedFlags: ReviewFlag[];
  reportsOpen: number;
  reply: ReviewReplyRef | null;
  createdAt: string;
  editedAt: string | null;
}
export interface ReviewList {
  data: ReviewRow[];
  meta: ListMeta & { counts: ReviewTabCounts };
}

export interface ReviewReport {
  id: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  reporter: PersonRef | null;
  resolvedBy: PersonRef | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  disputeId: string | null;
  createdAt: string;
}
export interface ReviewReplyDetail extends ReviewReplyRef {
  provider: PersonRef;
  editedAt: string | null;
  moderatedBy: PersonRef | null;
  reportsOpen: number;
  createdAt: string;
}
export interface ReviewDetail extends Omit<ReviewRow, "reply" | "booking"> {
  reply: ReviewReplyDetail | null;
  booking: {
    id: string;
    reference: string;
    status: BookingStatus;
    disputeStatus: BookingDisputeStatus;
    eventDate: string;
    total: string;
  };
  disputes: { id: string; reference: string; status: DisputeStatus }[];
  reports: ReviewReport[];
  moderatedBy: PersonRef | null;
  moderatedAt: string | null;
  moderationNote: string | null;
  allowedActions: ReviewAction[];
  updatedAt: string;
}

export interface ModerateReviewBody {
  action: ModerationAction;
  redactedComment?: string;
  note?: string;
  notifyAuthor?: boolean;
}
export interface EditReviewBody {
  comment: string;
  reason: string;
}
export interface DeleteReviewBody {
  reason: string;
}
export interface ReviewDeleted {
  id: string;
  deletedAt: string;
  reportsResolved: number;
}
export interface ReplyDeleted {
  id: string;
  reviewId: string;
  deletedAt: string;
}

export interface ReportTarget {
  label: string;
  href: string | null;
  reviewId: string | null;
  conversationId: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  exists: boolean;
}
export interface ReportRow {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  target: ReportTarget;
  reason: ReportReason;
  note: string | null;
  reporter: PersonRef | null;
  status: ReportStatus;
  createdAt: string;
  resolvedBy: PersonRef | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  disputeId: string | null;
  disputeReference: string | null;
}
export interface ReportTabCounts {
  open: number;
  resolved: number;
  dismissed: number;
  all: number;
}
export interface ReportList {
  data: ReportRow[];
  meta: ListMeta & { counts: ReportTabCounts };
}
export interface ResolveReportBody {
  note: string;
  action?: ReportResolveAction;
}
export interface DismissReportBody {
  note: string;
}
export interface ConvertReportBody {
  type: DisputeType;
  description: string;
  openedByRole: "client" | "provider";
}
export interface MessageReportsDismissed {
  messageId: string;
  dismissed: number;
}

export const reviewKeys = {
  all: ["reviews"] as const,
  detail: (id: string) => [...reviewKeys.all, "detail", id] as const,
};
export const reportKeys = {
  all: ["reports"] as const,
};

/** DataList URL params → `GET /admin/reviews` query (`provider`/`service`/`pack`/`author` come from other screens). */
export function reviewsQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" && f[k] ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const created = parseRange(f.created);
  const bool = (k: string) => (one(k) === "true" ? true : one(k) === "false" ? false : undefined);
  return {
    tab: p.tab && p.tab !== "all" ? p.tab : undefined,
    q: p.q || undefined,
    rating: list("rating").map(Number),
    providerId: one("provider"),
    serviceId: one("service"),
    packId: one("pack"),
    authorId: one("author"),
    hadDispute: bool("hadDispute"),
    flagged: bool("flagged"),
    createdFrom: created.from || undefined,
    createdTo: created.to || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function reportsQuery(
  p: Pick<ListParams, "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const list = (k: string) =>
    Array.isArray(f[k]) ? (f[k] as string[]) : typeof f[k] === "string" && f[k] ? [f[k] as string] : [];
  const created = parseRange(f.created);
  return {
    tab: p.tab || undefined,
    targetType: list("targetType"),
    reason: list("reason"),
    createdFrom: created.from || undefined,
    createdTo: created.to || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listReviews(query: QueryParams): Promise<ReviewList> {
  return api.get<ReviewList>("/admin/reviews", { query });
}
export async function getReview(id: string): Promise<ReviewDetail> {
  return (await api.get<DataResponse<ReviewDetail>>(`/admin/reviews/${id}`)).data;
}
export async function moderateReview(id: string, body: ModerateReviewBody): Promise<ReviewDetail> {
  return (await api.post<DataResponse<ReviewDetail>>(`/admin/reviews/${id}/moderate`, body)).data;
}
export async function editReview(id: string, body: EditReviewBody): Promise<ReviewDetail> {
  return (await api.patch<DataResponse<ReviewDetail>>(`/admin/reviews/${id}`, body)).data;
}
export async function deleteReview(id: string, body: DeleteReviewBody): Promise<ReviewDeleted> {
  return (await api.delete<DataResponse<ReviewDeleted>>(`/admin/reviews/${id}`, { body })).data;
}
export async function hideReply(id: string, note?: string): Promise<ReviewDetail> {
  return (await api.post<DataResponse<ReviewDetail>>(`/admin/review-replies/${id}/hide`, { note })).data;
}
export async function showReply(id: string, note?: string): Promise<ReviewDetail> {
  return (await api.post<DataResponse<ReviewDetail>>(`/admin/review-replies/${id}/show`, { note })).data;
}
export async function deleteReply(id: string): Promise<ReplyDeleted> {
  return (await api.delete<DataResponse<ReplyDeleted>>(`/admin/review-replies/${id}`)).data;
}

export function listReports(query: QueryParams): Promise<ReportList> {
  return api.get<ReportList>("/admin/reports", { query });
}
export async function resolveReport(id: string, body: ResolveReportBody): Promise<ReportRow> {
  return (await api.post<DataResponse<ReportRow>>(`/admin/reports/${id}/resolve`, body)).data;
}
export async function dismissReport(id: string, body: DismissReportBody): Promise<ReportRow> {
  return (await api.post<DataResponse<ReportRow>>(`/admin/reports/${id}/dismiss`, body)).data;
}
export async function convertReport(id: string, body: ConvertReportBody): Promise<ReportRow> {
  return (await api.post<DataResponse<ReportRow>>(`/admin/reports/${id}/convert-to-dispute`, body)).data;
}
export async function dismissMessageReports(
  messageId: string,
  body: DismissReportBody,
): Promise<MessageReportsDismissed> {
  return (
    await api.post<DataResponse<MessageReportsDismissed>>(
      `/admin/messages/${messageId}/reports/dismiss`,
      body,
    )
  ).data;
}

/* ------------------------------------------------------------------ flags (mirror of the API detector) */

const FLAG_PATTERNS: [Exclude<ReviewFlag, "insult">, RegExp][] = [
  ["email", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["link", /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|dz|net|org|fr|io|me)\b(?:\/\S*)?/gi],
  ["phone", /(?:\+|00)?\d[\d\s.-]{7,}\d/g],
  ["handle", /(?:^|\s)@[\w.]{3,}/g],
];

export interface TextSegment {
  text: string;
  flag?: ReviewFlag;
}

/** Splits a comment into plain and flagged parts (REV-02 highlights contact details). */
export function flagSegments(text: string): TextSegment[] {
  const hits: { start: number; end: number; flag: ReviewFlag }[] = [];
  for (const [flag, re] of FLAG_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      let start = m.index ?? 0;
      let value = m[0];
      if (flag === "handle" && /^\s/.test(value)) {
        start += 1;
        value = value.slice(1);
      }
      const end = start + value.length;
      if (flag === "phone" && value.replace(/\D/g, "").length < 8) continue;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      hits.push({ start, end, flag });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: TextSegment[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) out.push({ text: text.slice(pos, h.start) });
    out.push({ text: text.slice(h.start, h.end), flag: h.flag });
    pos = h.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Prefilled redacted text: contact details replaced by `mask` ("hide the phone number only"). */
export function maskContacts(text: string, mask: string): string {
  return flagSegments(text)
    .map((s) => (s.flag ? mask : s.text))
    .join("");
}

/** The open report the "Convert to dispute" action uses (on the review first, then on its reply). */
export function firstOpenReport(review: Pick<ReviewDetail, "reports">): ReviewReport | undefined {
  const open = review.reports.filter((r) => r.status === "open");
  return open.find((r) => r.targetType === "review") ?? open[0];
}

/** Dashboard routes sent by the API (`/reviews/:id`, `/activity-log/:id`…) → routes of this app. */
export function dashboardHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const [path, query] = href.split("?");
  const qs = query ? `&${query}` : "";
  let m = /^\/reviews\/([\w-]+)$/.exec(path);
  if (m) return `/reviews?review=${m[1]}${qs}`;
  m = /^\/activity-log\/([\w-]+)$/.exec(path);
  if (m) return `/activity-log?entry=${m[1]}${qs}`;
  m = /^\/locations\/(\d+)$/.exec(path);
  if (m) return `/locations?wilaya=${m[1]}${qs}`;
  if (path === "/settings/admins") return "/settings#admins";
  return href;
}
