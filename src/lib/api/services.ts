/**
 * Module 6 — services (SRV-01 … SRV-06) and provider availability.
 * `GET/POST /admin/services`, `GET/PATCH/DELETE /admin/services/:id`, hide / show / publish / unpublish /
 * feature / unfeature, photos, `GET /admin/providers/:id/availability`, availability blocks.
 */
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import { ApiError } from "./errors";
import type { CategoryRef, PersonRef, VerificationStatus, WilayaRef } from "./users";

export type ServiceStatus = "draft" | "published" | "hidden";
export type PriceType = "per_event" | "per_hour" | "per_person" | "per_day" | "on_quote";
export type ServiceTab = "all" | "published" | "draft" | "hidden" | "waiting_approval" | "reported";

export const PRICE_TYPES: PriceType[] = ["per_event", "per_hour", "per_person", "per_day", "on_quote"];
export const HIDE_REASONS = [
  "misleading_content",
  "inappropriate_content",
  "wrong_category",
  "duplicate",
  "reported_by_clients",
  "provider_request",
  "other",
] as const;
export type HideReason = (typeof HIDE_REASONS)[number];

export type ServicePublishField =
  "titleEn" | "titleAr" | "descriptionEn" | "descriptionAr" | "price" | "photos" | "category" | "wilayas";

export type VisibilityReason =
  | "deleted"
  | "not_published"
  | "provider_blocked"
  | "provider_not_verified"
  | "provider_deleted"
  | "no_open_wilaya";

export interface ServiceProviderRef {
  id: string;
  fullName: string;
  businessName: string | null;
  status: "active" | "blocked";
  verificationStatus: VerificationStatus;
}

export interface ServiceRow {
  id: string;
  titleEn: string;
  titleAr: string;
  coverUrl: string | null;
  category: CategoryRef;
  provider: ServiceProviderRef;
  basePrice: string;
  priceType: PriceType;
  rating: number;
  ratingCount: number;
  bookingsCount: number;
  status: ServiceStatus;
  isFeatured: boolean;
  visibleInApp: boolean;
  wilayas: WilayaRef[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTabCounts {
  all: number;
  published: number;
  draft: number;
  hidden: number;
  waiting_approval: number;
  reported: number;
}

export interface ServiceList {
  data: ServiceRow[];
  meta: ListMeta & { counts: ServiceTabCounts };
}

export interface ServiceFact {
  label_en: string;
  label_ar: string;
  value_en: string;
  value_ar: string;
}
export interface ServiceExtra {
  id: string;
  nameEn: string;
  nameAr: string;
  price: string;
  position: number;
}
export interface Photo {
  id: string;
  fileId: string;
  position: number;
  isCover: boolean;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  width: number | null;
  height: number | null;
  processingStatus: "pending" | "ready" | "failed";
  createdAt: string;
}
export interface ServiceWilaya {
  code: number;
  name: string;
  nameAr: string;
  isOpen: boolean;
}
export interface HiddenInfo {
  reason: string;
  message: string | null;
  allowResubmit: boolean;
  hiddenBy: PersonRef | null;
  hiddenAt: string | null;
}
export interface PackRef {
  id: string;
  nameEn: string;
  nameAr: string;
  status: string;
  needsAttention: boolean;
}
export interface ServiceStats {
  bookings: {
    pending: number;
    accepted: number;
    declined: number;
    cancelled: number;
    completed: number;
    total: number;
  };
  revenue: string;
  ratingBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
  favourites: number;
  packsCount: number;
  packs: PackRef[];
}
export interface ServiceProviderCard extends ServiceProviderRef {
  avatarUrl: string | null;
  phone: string | null;
  email: string;
  rating: number;
  ratingCount: number;
  acceptingBookings: boolean;
  servicesCount: number;
  packsCount: number;
  bookingsCount: number;
  completedBookingsCount: number;
}

export interface ServiceDetail extends ServiceRow {
  descriptionEn: string;
  descriptionAr: string;
  cancellationPolicyEn: string | null;
  cancellationPolicyAr: string | null;
  facts: ServiceFact[];
  maxEventsPerDay: number;
  maxGuests: number | null;
  featuredPosition: number | null;
  favouritesCount: number;
  extras: ServiceExtra[];
  photos: Photo[];
  wilayaDetails: ServiceWilaya[];
  hidden: HiddenInfo | null;
  visibilityReasons: VisibilityReason[];
  publishMissing: ServicePublishField[];
  stats: ServiceStats;
  providerCard: ServiceProviderCard;
}

export interface ServiceDeleted {
  id: string;
  cancelledBookings: number;
  keptUpcomingBookings: number;
  packsNeedingAttention: number;
}

export interface ServiceExtraInput {
  nameEn: string;
  nameAr: string;
  price: string;
}

export interface CreateServiceBody {
  providerId: string;
  categoryId: string;
  titleEn: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  cancellationPolicyEn?: string | null;
  cancellationPolicyAr?: string | null;
  facts?: ServiceFact[] | null;
  basePrice: string;
  priceType: PriceType;
  maxEventsPerDay?: number;
  maxGuests?: number | null;
  wilayaCodes?: number[];
  extras?: ServiceExtraInput[];
  status?: "draft" | "published";
}
export type UpdateServiceBody = Partial<CreateServiceBody>;

export interface HideServiceBody {
  reason: HideReason;
  message?: string | null;
  allowResubmit: boolean;
}

/* ------------------------------------------------------------------ availability */

export type AvailabilityKind = "blocked" | "held" | "booked";
export type DayStatus = "free" | "partial" | "blocked" | "held" | "booked";

export interface AvailabilityBlock {
  id: string | null;
  kind: AvailabilityKind;
  date: string;
  startTime: string | null;
  endTime: string | null;
  service: { id: string; titleEn: string; titleAr: string } | null;
  booking: { id: string; reference: string; status: string } | null;
  note: string | null;
  removable: boolean;
}
export interface AvailabilityDay {
  date: string;
  status: DayStatus;
  items: AvailabilityBlock[];
}
export interface AvailabilityMonth {
  providerId: string;
  month: string;
  maxEventsPerDay: number;
  days: AvailabilityDay[];
}
export interface CreateBlockBody {
  date: string;
  startTime?: string;
  endTime?: string;
  serviceId?: string;
  note?: string | null;
}

/* ------------------------------------------------------------------ keys + queries */

export const serviceKeys = {
  all: ["services"] as const,
  detail: (id: string) => [...serviceKeys.all, "detail", id] as const,
  availability: (providerId: string, month: string) => ["availability", providerId, month] as const,
};

/** DataList URL params → `GET /admin/services` query. `provider` in the URL is `providerId`. */
export function servicesQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const price = parseRange(f.price);
  const created = parseRange(f.created);
  return {
    tab: p.tab && p.tab !== "all" ? p.tab : undefined,
    q: p.q || undefined,
    categoryId: one("categoryId"),
    providerId: one("provider"),
    wilaya: list("wilaya"),
    priceMin: price.from || undefined,
    priceMax: price.to || undefined,
    priceType: one("priceType"),
    ratingMin: one("ratingMin"),
    status: one("status"),
    featured: one("featured") === "true" ? true : undefined,
    providerStatus: one("providerStatus"),
    createdFrom: created.from || undefined,
    createdTo: created.to || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listServices(query: QueryParams): Promise<ServiceList> {
  return api.get<ServiceList>("/admin/services", { query });
}

export async function getService(id: string): Promise<ServiceDetail> {
  return (await api.get<DataResponse<ServiceDetail>>(`/admin/services/${id}`)).data;
}

export async function createService(body: CreateServiceBody): Promise<ServiceDetail> {
  return (await api.post<DataResponse<ServiceDetail>>("/admin/services", body)).data;
}

export async function updateService(id: string, body: UpdateServiceBody): Promise<ServiceDetail> {
  return (await api.patch<DataResponse<ServiceDetail>>(`/admin/services/${id}`, body)).data;
}

type ServiceAction = "show" | "publish" | "unpublish" | "feature" | "unfeature";
export async function serviceAction(id: string, action: ServiceAction): Promise<ServiceDetail> {
  return (await api.post<DataResponse<ServiceDetail>>(`/admin/services/${id}/${action}`)).data;
}

export async function hideService(id: string, body: HideServiceBody): Promise<ServiceDetail> {
  return (await api.post<DataResponse<ServiceDetail>>(`/admin/services/${id}/hide`, body)).data;
}

export async function deleteService(id: string, force = false): Promise<ServiceDeleted> {
  return (
    await api.delete<DataResponse<ServiceDeleted>>(`/admin/services/${id}`, {
      query: { force: force ? true : undefined },
    })
  ).data;
}

/* photos (services and packs share the shape) */

export async function uploadPhoto(resource: "services" | "packs", id: string, file: File): Promise<Photo[]> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<DataResponse<Photo[]>>(`/admin/${resource}/${id}/photos`, form)).data;
}

export async function reorderPhotos(resource: "services" | "packs", id: string, ids: string[]) {
  return (await api.patch<DataResponse<Photo[]>>(`/admin/${resource}/${id}/photos/order`, { ids })).data;
}

export async function deletePhoto(resource: "services" | "packs", id: string, photoId: string) {
  return (await api.delete<DataResponse<Photo[]>>(`/admin/${resource}/${id}/photos/${photoId}`)).data;
}

/* availability */

export async function getAvailability(providerId: string, month: string): Promise<AvailabilityMonth> {
  return (
    await api.get<DataResponse<AvailabilityMonth>>(`/admin/providers/${providerId}/availability`, {
      query: { month },
    })
  ).data;
}

export async function createBlock(providerId: string, body: CreateBlockBody): Promise<AvailabilityBlock> {
  return (
    await api.post<DataResponse<AvailabilityBlock>>(
      `/admin/providers/${providerId}/availability/blocks`,
      body,
    )
  ).data;
}

export function deleteBlock(id: string) {
  return api.delete<void>(`/admin/availability-blocks/${id}`);
}

/* ------------------------------------------------------------------ publish guard */

/** Form field (and scroll anchor) for each `SERVICE_PUBLISH_INVALID` `details.missing` entry. */
export const SERVICE_PUBLISH_FIELD: Record<ServicePublishField, string> = {
  titleEn: "title_en",
  titleAr: "title_ar",
  descriptionEn: "description_en",
  descriptionAr: "description_ar",
  price: "basePrice",
  photos: "photos",
  category: "categoryId",
  wilayas: "wilayaCodes",
};

/** `details.missing` of a SERVICE_PUBLISH_INVALID / PACK_PUBLISH_INVALID error, or null. */
export function publishMissing<T extends string = string>(error: unknown, code: string): T[] | null {
  if (!(error instanceof ApiError) || error.code !== code) return null;
  const d = error.details as { missing?: unknown } | null;
  return Array.isArray(d?.missing) ? (d.missing as T[]) : [];
}

/** Maps a publish guard error to `{ formField: missingKey }`, in form order (first = scroll target). */
export function servicePublishErrors(missing: string[]): Record<string, ServicePublishField> {
  const out: Record<string, ServicePublishField> = {};
  for (const key of Object.keys(SERVICE_PUBLISH_FIELD) as ServicePublishField[]) {
    if (missing.includes(key)) out[SERVICE_PUBLISH_FIELD[key]] = key;
  }
  return out;
}

export function localTitle(s: { titleEn: string; titleAr: string }, locale: string) {
  return locale === "ar" ? s.titleAr || s.titleEn : s.titleEn || s.titleAr;
}
