/**
 * Module 11 — messages (MSG-01 … MSG-03).
 * `GET/POST /admin/conversations`, `GET /admin/conversations/:id`, messages (cursor), send, read, close / reopen,
 * `POST /admin/messages/:id/hide|unhide`, `DELETE /admin/messages/:id`. Live: Socket.IO namespace `/admin`.
 */
import { api, API_URL, type DataResponse, type ListMeta, type QueryParams } from "./client";
import type { BookingStatus, MessageKind, MessageStatus } from "./bookings";
import type { PersonRef } from "./users";

export type ConversationKind = "direct" | "support" | "dispute";
export type ConversationStatus = "open" | "closed";
export type ParticipantRole = "client" | "provider" | "support";
export type ClosedScope = "all" | "one_participant";
export type ContactKind = "phone" | "email" | "url" | "handle";
export type InboxFilter = "all" | "reported" | "aboutBooking" | "disputes" | "unread";

export const INBOX_FILTERS: InboxFilter[] = ["all", "reported", "aboutBooking", "disputes", "unread"];
export const CLOSE_REASONS = ["harassment", "spam", "contact_outside", "fraud", "resolved", "other"] as const;

export interface ConversationCounts {
  all: number;
  reported: number;
  aboutBooking: number;
  disputes: number;
  unread: number;
}
export interface ParticipantRef {
  id: string;
  fullName: string;
  role: ParticipantRole;
  avatarUrl: string | null;
}
export interface LastMessage {
  bodyPreview: string | null;
  createdAt: string;
  senderName: string;
}
export interface ConversationBookingRef {
  id: string;
  reference: string;
  status: BookingStatus;
}
export interface ConversationRow {
  id: string;
  kind: ConversationKind;
  participants: ParticipantRef[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  booking: ConversationBookingRef | null;
  disputeId: string | null;
  status: ConversationStatus;
  reportsOpen: number;
  lastMessageAt: string | null;
}
export interface ConversationList {
  data: ConversationRow[];
  meta: ListMeta & { counts: ConversationCounts };
}

export interface ParticipantDetail extends ParticipantRef {
  userRole: "client" | "provider" | "admin";
  email: string;
  canWrite: boolean;
  blocked: boolean;
  lastReadAt: string | null;
}
export interface ConversationBookingCard extends ConversationBookingRef {
  eventDate: string;
  titleEn: string | null;
  titleAr: string | null;
  total: string;
}
export interface ConversationDispute {
  id: string;
  reference: string;
  status: "open" | "in_review" | "resolved" | "closed";
  type: string;
}
export interface OpenReport {
  id: string;
  messageId: string;
  reason: "inappropriate" | "spam" | "contact_outside" | "harassment" | "fake" | "other";
  note: string | null;
  reporter: PersonRef;
  createdAt: string;
}
export interface ClosedInfo {
  scope: ClosedScope;
  reason: string | null;
  closedBy: PersonRef | null;
  closedAt: string | null;
  mutedUserIds: string[];
}
export interface ConversationDetail {
  id: string;
  kind: ConversationKind;
  status: ConversationStatus;
  participants: ParticipantDetail[];
  booking: ConversationBookingCard | null;
  dispute: ConversationDispute | null;
  reports: OpenReport[];
  closed: ClosedInfo | null;
  contactUnmasked: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface MessageSender {
  id: string;
  fullName: string;
  role: "client" | "provider" | "admin";
  avatarUrl: string | null;
}
export interface AdminMessage {
  id: string;
  conversationId: string;
  kind: MessageKind;
  sender: MessageSender | null;
  senderLabel: string;
  body: string | null;
  bodyMasked: string | null;
  masked: boolean;
  detectedContacts: ContactKind[];
  status: MessageStatus;
  moderation: { by: PersonRef | null; at: string | null } | null;
  reportsOpen: number;
  fileId: string | null;
  createdAt: string;
}
export interface MessagesPage {
  data: AdminMessage[];
  meta: { limit: number; hasMore: boolean; nextBefore: string | null };
}

export interface CreateConversationBody {
  userIds: string[];
  body: string;
  bookingId?: string;
  email?: boolean;
}
export interface CloseConversationBody {
  scope: ClosedScope;
  userId?: string;
  reason: string;
  resolveReports?: boolean;
}
export interface ReadResult {
  conversationId: string;
  unreadCount: number;
  lastReadAt: string | null;
}

export const conversationKeys = {
  all: ["conversations"] as const,
  list: (q: QueryParams) => [...conversationKeys.all, "list", q] as const,
  detail: (id: string) => [...conversationKeys.all, "detail", id] as const,
  messages: (id: string) => [...conversationKeys.all, "messages", id] as const,
  badge: () => [...conversationKeys.all, "badge"] as const,
};

/** Inbox chip → list filters. */
export function inboxQuery(filter: InboxFilter, extra: { q?: string; userId?: string; bookingId?: string }) {
  return {
    reported: filter === "reported" ? true : undefined,
    aboutBooking: filter === "aboutBooking" ? true : undefined,
    kind: filter === "disputes" ? "dispute" : undefined,
    unread: filter === "unread" ? true : undefined,
    q: extra.q || undefined,
    userId: extra.userId || undefined,
    bookingId: extra.bookingId || undefined,
  } satisfies QueryParams;
}

export function listConversations(query: QueryParams): Promise<ConversationList> {
  return api.get<ConversationList>("/admin/conversations", { query });
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return (await api.get<DataResponse<ConversationDetail>>(`/admin/conversations/${id}`)).data;
}

export function listMessages(
  id: string,
  query: { before?: string; limit?: number } = {},
): Promise<MessagesPage> {
  return api.get<MessagesPage>(`/admin/conversations/${id}/messages`, { query });
}

export async function createConversation(body: CreateConversationBody): Promise<ConversationDetail> {
  return (await api.post<DataResponse<ConversationDetail>>("/admin/conversations", body)).data;
}

export async function sendMessage(id: string, body: string): Promise<AdminMessage> {
  return (await api.post<DataResponse<AdminMessage>>(`/admin/conversations/${id}/messages`, { body })).data;
}

export async function markRead(id: string): Promise<ReadResult> {
  return (await api.post<DataResponse<ReadResult>>(`/admin/conversations/${id}/read`)).data;
}

export async function closeConversation(
  id: string,
  body: CloseConversationBody,
): Promise<ConversationDetail> {
  return (await api.post<DataResponse<ConversationDetail>>(`/admin/conversations/${id}/close`, body)).data;
}

export async function reopenConversation(id: string): Promise<ConversationDetail> {
  return (await api.post<DataResponse<ConversationDetail>>(`/admin/conversations/${id}/reopen`)).data;
}

export type ModerationAction = "hide" | "unhide" | "delete";
export async function moderateMessage(
  id: string,
  action: ModerationAction,
  reason?: string | null,
): Promise<AdminMessage> {
  const body = { reason: reason ?? null };
  const res =
    action === "delete"
      ? await api.delete<DataResponse<AdminMessage>>(`/admin/messages/${id}`, { body })
      : await api.post<DataResponse<AdminMessage>>(`/admin/messages/${id}/${action}`, body);
  return res.data;
}

/** Socket.IO origin: the API host without `/api/v1`. */
export const SOCKET_URL = API_URL.replace(/\/api\/v\d+$/, "");

/** Other participants' names, e.g. "Karima Ait & DJ Amine". */
export function conversationTitle(participants: { fullName: string; role: string }[]) {
  const people = participants.filter((p) => p.role !== "support");
  return (people.length ? people : participants).map((p) => p.fullName).join(" & ");
}
