/**
 * Module 10 — request forms (ACR-05, ACR-06) and the public web form (ACR-07).
 * Admin: `GET/POST /admin/forms`, `GET/PATCH/DELETE /admin/forms/:id`, `PUT …/draft`, publish, close, reopen,
 * duplicate, `GET …/versions/:versionId`.
 * Public (no token): `GET /forms/:slug`, email-code, uploads, submissions, `GET/PATCH /forms/:slug/requests/:token`.
 */
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, buildUrl, type DataResponse, type ListMeta, type QueryParams } from "./client";
import { toApiError } from "./errors";
import type { PersonRef } from "./users";

export type FormStatus = "draft" | "published" | "closed";
export type FormTab = FormStatus | "all";
export const FORM_TABS: FormTab[] = ["all", "published", "draft", "closed"];

export interface FormTabCounts {
  all: number;
  draft: number;
  published: number;
  closed: number;
}
export interface FormVersionRef {
  id: string;
  version: number;
  publishedAt: string;
}
export interface FormRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  status: FormStatus;
  isDefault: boolean;
  requiresAuth: boolean;
  liveVersion: FormVersionRef | null;
  submissionsCount: number;
  hasDraftChanges: boolean;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
}
export interface FormList {
  data: FormRow[];
  meta: ListMeta & { counts: FormTabCounts };
}
export interface FormVersionSummary extends FormVersionRef {
  publishedBy: PersonRef | null;
  submissionsCount: number;
}
export interface FormVersion extends FormVersionSummary {
  formId: string;
  schema: Record<string, unknown>;
}
export interface FormDetail extends FormRow {
  descriptionEn: string | null;
  descriptionAr: string | null;
  maxSubmissionsPerEmailPerMonth: number | null;
  confirmationEn: string;
  confirmationAr: string;
  draftSchema: Record<string, unknown> | null;
  versions: FormVersionSummary[];
  createdBy: PersonRef | null;
}

export interface CreateFormBody {
  nameEn: string;
  nameAr: string;
  slug?: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
}
export interface UpdateFormBody {
  nameEn?: string;
  nameAr?: string;
  slug?: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  requiresAuth?: boolean;
  maxSubmissionsPerEmailPerMonth?: number | null;
  confirmationEn?: string;
  confirmationAr?: string;
  isDefault?: boolean;
  updatedAt?: string;
}
export interface SaveDraftBody {
  schema: Record<string, unknown>;
  updatedAt?: string;
}

export const formKeys = {
  all: ["forms"] as const,
  detail: (id: string) => [...formKeys.all, "detail", id] as const,
  version: (id: string, versionId: string) => [...formKeys.all, "version", id, versionId] as const,
  public: (slug: string) => ["public-form", slug] as const,
  editable: (slug: string, token: string) => ["public-form", slug, "edit", token] as const,
};

export function formsQuery(
  p: Pick<ListParams, "q" | "tab" | "sort"> & { page?: number; limit?: number },
): QueryParams {
  return {
    tab: p.tab && p.tab !== "all" ? p.tab : undefined,
    q: p.q || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listForms(query: QueryParams): Promise<FormList> {
  return api.get<FormList>("/admin/forms", { query });
}
export async function getForm(id: string): Promise<FormDetail> {
  return (await api.get<DataResponse<FormDetail>>(`/admin/forms/${id}`)).data;
}
export async function createForm(body: CreateFormBody): Promise<FormDetail> {
  return (await api.post<DataResponse<FormDetail>>("/admin/forms", body)).data;
}
export async function updateForm(id: string, body: UpdateFormBody): Promise<FormDetail> {
  return (await api.patch<DataResponse<FormDetail>>(`/admin/forms/${id}`, body)).data;
}
export async function saveFormDraft(id: string, body: SaveDraftBody): Promise<FormDetail> {
  return (await api.put<DataResponse<FormDetail>>(`/admin/forms/${id}/draft`, body)).data;
}
export async function publishForm(id: string): Promise<FormDetail> {
  return (await api.post<DataResponse<FormDetail>>(`/admin/forms/${id}/publish`)).data;
}
export async function closeForm(id: string): Promise<FormDetail> {
  return (await api.post<DataResponse<FormDetail>>(`/admin/forms/${id}/close`)).data;
}
export async function reopenForm(id: string): Promise<FormDetail> {
  return (await api.post<DataResponse<FormDetail>>(`/admin/forms/${id}/reopen`)).data;
}
export async function duplicateForm(id: string): Promise<FormDetail> {
  return (await api.post<DataResponse<FormDetail>>(`/admin/forms/${id}/duplicate`)).data;
}
export function deleteForm(id: string): Promise<void> {
  return api.delete<void>(`/admin/forms/${id}`);
}
export async function getFormVersion(id: string, versionId: string): Promise<FormVersion> {
  return (await api.get<DataResponse<FormVersion>>(`/admin/forms/${id}/versions/${versionId}`)).data;
}

/** Public link on this dashboard (the API's `publicUrl` may point at another host). */
export function publicFormPath(slug: string) {
  return `/f/${slug}`;
}

/* ------------------------------------------------------------------ public */

export interface PublicForm {
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  version: number;
  schema: Record<string, unknown>;
  requiresAuth: boolean;
  maxSubmissionsPerEmailPerMonth: number | null;
  confirmationEn: string;
  confirmationAr: string;
  uploadMaxMb: number;
  /** Not in the API yet: service categories for `service_categories` fields. */
  categories?: { id: string; nameEn: string; nameAr: string }[];
}
export interface EmailCodeResult {
  email: string;
  expiresAt: string;
  resendAfterSeconds: number;
}
export interface UploadResult {
  uploadToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string;
}
export interface UploadRef {
  fieldKey: string;
  uploadToken: string;
}
export interface SubmitFormBody {
  email: string;
  code: string;
  answers: Record<string, unknown>;
  uploads?: UploadRef[];
}
export interface SubmissionResult {
  reference: string;
  status: string;
  submittedAt: string;
  confirmationEn: string;
  confirmationAr: string;
}
export interface EditableRequest {
  reference: string;
  status: string;
  requestedChanges: { fields: string[]; message: string };
  formNameEn: string;
  formNameAr: string;
  version: number;
  schema: Record<string, unknown>;
  answers: Record<string, unknown>;
  email: string;
  linkExpiresAt: string;
}
export interface EditAnswersBody {
  answers: Record<string, unknown>;
  uploads?: UploadRef[];
}

const pub = { public: true } as const;
const enc = encodeURIComponent;

export interface PublicCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  position: number;
}
export interface PublicWilaya {
  code: number;
  name: string;
  nameAr: string;
}
/** `GET /public/categories` — visible categories (ACR-07 `service_categories`). */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  return (await api.get<DataResponse<PublicCategory[]>>("/public/categories", pub)).data;
}
/** `GET /public/wilayas` — wilayas open for bookings (ACR-07 `wilaya`). */
export async function getPublicWilayas(): Promise<PublicWilaya[]> {
  return (await api.get<DataResponse<PublicWilaya[]>>("/public/wilayas", pub)).data;
}

export async function getPublicForm(slug: string): Promise<PublicForm> {
  return (await api.get<DataResponse<PublicForm>>(`/forms/${enc(slug)}`, pub)).data;
}
export async function sendFormCode(slug: string, email: string): Promise<EmailCodeResult> {
  return (await api.post<DataResponse<EmailCodeResult>>(`/forms/${enc(slug)}/email-code`, { email }, pub))
    .data;
}
export async function submitForm(slug: string, body: SubmitFormBody): Promise<SubmissionResult> {
  return (await api.post<DataResponse<SubmissionResult>>(`/forms/${enc(slug)}/submissions`, body, pub)).data;
}
export async function getEditableRequest(slug: string, token: string): Promise<EditableRequest> {
  return (await api.get<DataResponse<EditableRequest>>(`/forms/${enc(slug)}/requests/${enc(token)}`, pub))
    .data;
}
export async function editRequestAnswers(
  slug: string,
  token: string,
  body: EditAnswersBody,
): Promise<EditableRequest> {
  return (
    await api.patch<DataResponse<EditableRequest>>(`/forms/${enc(slug)}/requests/${enc(token)}`, body, pub)
  ).data;
}

/** Public upload with progress (XHR: fetch has no upload progress). */
export function uploadFormFile(
  slug: string,
  file: File,
  onProgress?: (percent: number) => void,
  locale = "en",
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(`/forms/${enc(slug)}/uploads`));
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Accept-Language", locale);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = async () => {
      const res = new Response(xhr.responseText, { status: xhr.status });
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(((await res.json()) as DataResponse<UploadResult>).data);
      } else reject(await toApiError(res));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
