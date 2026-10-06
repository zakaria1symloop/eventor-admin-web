/**
 * Module 7 — Ready Packs (PCK-01 … PCK-03).
 * `GET/POST /admin/packs`, `GET/PATCH/DELETE /admin/packs/:id`, publish / unpublish / duplicate, photos.
 */
import { parseRange } from "@/components/data-list/advanced-filters-drawer";
import type { ListParams } from "@/components/data-list/use-list-state";
import { api, type DataResponse, type ListMeta, type QueryParams } from "./client";
import type { Photo, PriceType, ServiceProviderRef, ServiceStatus } from "./services";
import type { PersonRef, WilayaRef } from "./users";

export type PackStatus = "draft" | "published" | "unpublished";
export type PackTab = "all" | "published" | "draft" | "unpublished" | "needs_attention";
export const EVENT_TYPES = [
  "wedding",
  "engagement",
  "henna",
  "birthday",
  "circumcision",
  "graduation",
  "corporate",
  "conference",
  "academic",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type PackPublishField =
  | "nameEn"
  | "nameAr"
  | "items"
  | "unpublishedItems"
  | "providerBlocked"
  | "providerNotVerified"
  | "priceNotBelowSum"
  | "wilayaNotCovered";
/** Checklist order; `nameEn` and `providerBlocked` are covered by the `nameAr` / `providerNotVerified` rows. */
export const PACK_PUBLISH_FIELDS: PackPublishField[] = [
  "items",
  "providerNotVerified",
  "nameAr",
  "unpublishedItems",
  "wilayaNotCovered",
  "priceNotBelowSum",
];

export type AttentionCode =
  "item_not_published" | "item_deleted" | "provider_blocked" | "provider_not_verified" | "provider_deleted";

export interface PackRow {
  id: string;
  nameEn: string;
  nameAr: string;
  coverUrl: string | null;
  provider: ServiceProviderRef;
  itemsCount: number;
  itemsSummary: { nameEn: string; nameAr: string }[];
  price: string;
  sumOfItems: string;
  savings: string;
  savingsPercent: number;
  eventType: EventType;
  wilaya: WilayaRef;
  rating: number;
  ratingCount: number;
  bookingsCount: number;
  status: PackStatus;
  needsAttention: boolean;
  visibleInApp: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackTabCounts {
  all: number;
  published: number;
  draft: number;
  unpublished: number;
  needs_attention: number;
}

export interface PackList {
  data: PackRow[];
  meta: ListMeta & { counts: PackTabCounts };
}

export interface PackItem {
  position: number;
  service: {
    id: string;
    titleEn: string;
    titleAr: string;
    coverUrl: string | null;
    category: { id: string; nameEn: string; nameAr: string };
    status: ServiceStatus;
    priceType: PriceType;
    rating: number;
  };
  price: string;
  availability: "available" | "not_published" | "hidden" | "deleted";
}

export interface PackDetail extends PackRow {
  descriptionEn: string | null;
  descriptionAr: string | null;
  maxGuests: number | null;
  items: PackItem[];
  photos: Photo[];
  attentionReasons: { code: AttentionCode; serviceId: string | null }[];
  publishMissing: PackPublishField[];
  stats: { total: number; published: number };
  createdBy: PersonRef | null;
}

export interface CreatePackBody {
  providerId: string;
  nameEn: string;
  nameAr?: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  eventType: EventType;
  wilayaCode: number;
  price: string;
  maxGuests?: number | null;
  serviceIds: string[];
}
export type UpdatePackBody = Partial<CreatePackBody>;

export const packKeys = {
  all: ["packs"] as const,
  detail: (id: string) => [...packKeys.all, "detail", id] as const,
};

export function packsQuery(
  p: Pick<ListParams, "q" | "tab" | "sort" | "filters"> & { page?: number; limit?: number },
): QueryParams {
  const f = p.filters;
  const one = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : one(k) ? [one(k)!] : []);
  const price = parseRange(f.price);
  return {
    tab: p.tab && p.tab !== "all" ? p.tab : undefined,
    q: p.q || undefined,
    providerId: one("provider"),
    eventType: one("eventType"),
    wilaya: list("wilaya"),
    priceMin: price.from || undefined,
    priceMax: price.to || undefined,
    sort: p.sort || undefined,
    page: p.page,
    limit: p.limit,
  };
}

export function listPacks(query: QueryParams): Promise<PackList> {
  return api.get<PackList>("/admin/packs", { query });
}

export async function getPack(id: string): Promise<PackDetail> {
  return (await api.get<DataResponse<PackDetail>>(`/admin/packs/${id}`)).data;
}

export async function createPack(body: CreatePackBody): Promise<PackDetail> {
  return (await api.post<DataResponse<PackDetail>>("/admin/packs", body)).data;
}

export async function updatePack(id: string, body: UpdatePackBody): Promise<PackDetail> {
  return (await api.patch<DataResponse<PackDetail>>(`/admin/packs/${id}`, body)).data;
}

export async function packAction(
  id: string,
  action: "publish" | "unpublish" | "duplicate",
): Promise<PackDetail> {
  return (await api.post<DataResponse<PackDetail>>(`/admin/packs/${id}/${action}`)).data;
}

export async function deletePack(id: string): Promise<{ id: string; cancelledBookings: number }> {
  return (await api.delete<DataResponse<{ id: string; cancelledBookings: number }>>(`/admin/packs/${id}`))
    .data;
}

/** Live pack price maths (PCK-03 price card): sum of the items, savings and percent. */
export function packTotals(itemPrices: (string | number)[], price: number | null) {
  const sum = itemPrices.reduce<number>((s, p) => s + Number(p || 0), 0);
  const savings = price === null ? 0 : sum - price;
  const percent = sum > 0 && price !== null ? Math.round((savings / sum) * 1000) / 10 : 0;
  return { sum, savings, percent, belowSum: price !== null && price > 0 && price < sum };
}

export function localPackName(p: { nameEn: string; nameAr: string }, locale: string) {
  return locale === "ar" ? p.nameAr || p.nameEn : p.nameEn || p.nameAr;
}
