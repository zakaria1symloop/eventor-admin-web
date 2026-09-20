/**
 * Module 5 — provider verification (VER-01 … VER-04).
 * `GET /admin/verifications`, `GET /admin/verifications/:userId`, document approve / reject / undo, upload on behalf.
 */
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import type {
  CategoryRef,
  DocumentStatus,
  DocumentType,
  DocumentsSummary,
  PersonRef,
  VerificationStatus,
  WilayaRef,
} from "./users";

export type VerificationTab = "waiting" | "resubmitted" | "approved" | "rejected" | "incomplete" | "all";
export type VerificationRowStatus = Exclude<VerificationTab, "all">;
export type RejectReason = "unreadable" | "expired" | "name_mismatch" | "wrong_document" | "other";

export const VERIFICATION_TABS: VerificationTab[] = [
  "waiting",
  "resubmitted",
  "approved",
  "rejected",
  "incomplete",
  "all",
];
export const DOCUMENT_TYPES: DocumentType[] = [
  "national_id",
  "commercial_register_or_artisan_card",
  "tax_card",
];
export const REJECT_REASONS: RejectReason[] = [
  "unreadable",
  "expired",
  "name_mismatch",
  "wrong_document",
  "other",
];

export interface VerificationRow {
  user: { id: string; fullName: string; email: string; phone: string | null; avatarUrl: string | null };
  businessName: string | null;
  category: CategoryRef | null;
  wilaya: WilayaRef | null;
  documents: DocumentsSummary["items"];
  progress: DocumentsSummary["progress"];
  submittedAt: string | null;
  status: VerificationRowStatus;
  verificationStatus: VerificationStatus;
}

export type VerificationTabCounts = Record<VerificationTab, number>;

export interface VerificationList {
  data: VerificationRow[];
  meta: ListMeta & { counts: VerificationTabCounts };
}

/** One file version (`DocumentDto`). */
export interface ReviewDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  isCurrent: boolean;
  viewUrl: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  uploadedAt: string;
  rejectReason: RejectReason | null;
  rejectNote: string | null;
  reviewedBy: PersonRef | null;
  reviewedAt: string | null;
}

/** One required document type with its current version and history (`DocumentSlotDto`). */
export interface DocumentSlot {
  type: DocumentType;
  current: ReviewDocument | null;
  previous: ReviewDocument[];
}

export interface VerificationAccount {
  id: string;
  fullName: string;
  email: string;
  emailVerifiedAt: string | null;
  phone: string | null;
  avatarUrl: string | null;
  language: "ar" | "en";
  status: "active" | "blocked";
  businessName: string | null;
  category: CategoryRef | null;
  wilaya: WilayaRef | null;
  createdAt: string;
}

export interface QueueNeighbours {
  prevUserId: string | null;
  nextUserId: string | null;
  position: number | null;
  total: number;
}

export interface VerificationDetail {
  verificationStatus: VerificationStatus;
  status: VerificationRowStatus;
  progress: DocumentsSummary["progress"];
  documents: DocumentSlot[];
  account: VerificationAccount;
  neighbours: QueueNeighbours;
}

export interface DocumentDecision {
  document: ReviewDocument;
  verificationStatus: VerificationStatus;
  previousVerificationStatus: VerificationStatus;
  progress: DocumentsSummary["progress"];
}

export const verificationKeys = {
  all: ["verifications"] as const,
  detail: (userId: string, filters: QueryParams) =>
    [...verificationKeys.all, "detail", userId, filters] as const,
  waitingCount: () => [...verificationKeys.all, "waiting-count"] as const,
};

/** DataList params → list / detail query (the detail endpoint takes the same filters for its queue). */
export function verificationsQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const submitted = parseRange(f.submitted);
  return {
    tab: p.tab || undefined,
    q: p.q || undefined,
    categoryId: one("categoryId"),
    wilaya: Array.isArray(f.wilaya) ? f.wilaya : one("wilaya"),
    documentType: one("documentType"),
    submittedFrom: submitted.from || undefined,
    submittedTo: submitted.to || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listVerifications(query: QueryParams): Promise<VerificationList> {
  return api.get<VerificationList>("/admin/verifications", { query });
}

export async function getVerification(userId: string, query: QueryParams): Promise<VerificationDetail> {
  return (await api.get<DataResponse<VerificationDetail>>(`/admin/verifications/${userId}`, { query })).data;
}

export async function approveDocument(id: string): Promise<DocumentDecision> {
  return (await api.post<DataResponse<DocumentDecision>>(`/admin/documents/${id}/approve`)).data;
}

export async function rejectDocument(
  id: string,
  body: { reasonCode: RejectReason; message: string },
): Promise<DocumentDecision> {
  return (await api.post<DataResponse<DocumentDecision>>(`/admin/documents/${id}/reject`, body)).data;
}

export async function undoDocument(id: string): Promise<DocumentDecision> {
  return (await api.post<DataResponse<DocumentDecision>>(`/admin/documents/${id}/undo`)).data;
}

export async function uploadDocument(
  userId: string,
  type: DocumentType,
  file: File,
): Promise<DocumentDecision> {
  const form = new FormData();
  form.append("type", type);
  form.append("file", file);
  return (await api.post<DataResponse<DocumentDecision>>(`/admin/users/${userId}/documents`, form)).data;
}
