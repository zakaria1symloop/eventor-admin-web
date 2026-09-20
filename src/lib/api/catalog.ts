/**
 * Module 3 — categories (CAT-01/02), wilayas and communes (LOC-01/02).
 */
import { api, buildUrl, type DataResponse, type ListMeta, type QueryParams } from "./client";

/* ------------------------------------------------------------------ categories */

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  icon: string;
  position: number;
  isVisible: boolean;
  servicesCount: number;
  providersCount: number;
  bookings30dCount: number;
  missingTranslation: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TabCounts {
  [tab: string]: number;
}

export interface CountedList<T> {
  data: T[];
  meta: ListMeta & { counts?: TabCounts };
}

export interface CategoryBody {
  slug?: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  icon: string;
  isVisible?: boolean;
}

export const categoryKeys = {
  all: ["categories"] as const,
  options: () => [...categoryKeys.all, "options"] as const,
};

export function listCategories(query: QueryParams): Promise<CountedList<Category>> {
  return api.get<CountedList<Category>>("/admin/categories", { query });
}

export async function createCategory(body: CategoryBody): Promise<Category> {
  return (await api.post<DataResponse<Category>>("/admin/categories", body)).data;
}

export async function updateCategory(id: string, body: Partial<CategoryBody>): Promise<Category> {
  return (await api.patch<DataResponse<Category>>(`/admin/categories/${id}`, body)).data;
}

export function reorderCategories(ids: string[]) {
  return api.patch<unknown>("/admin/categories/order", { ids });
}

export function deleteCategory(id: string, moveTo?: string) {
  return api.delete<unknown>(`/admin/categories/${id}`, { query: { moveTo } });
}

/* ------------------------------------------------------------------ wilayas */

export type WilayaRegion = "north_centre" | "north_east" | "north_west" | "highlands" | "south";
export const WILAYA_REGIONS: WilayaRegion[] = [
  "north_centre",
  "north_east",
  "north_west",
  "highlands",
  "south",
];

export interface Wilaya {
  code: number;
  name: string;
  nameAr: string;
  region: WilayaRegion;
  isOpen: boolean;
  communesCount: number;
  providersCount: number;
  servicesCount: number;
  clientsCount: number;
  updatedAt?: string;
}

export const wilayaKeys = {
  all: ["wilayas"] as const,
  detail: (code: number | string) => [...wilayaKeys.all, "detail", String(code)] as const,
  communes: (code: number | string) => [...wilayaKeys.all, "communes", String(code)] as const,
};

export function listWilayas(query: QueryParams): Promise<CountedList<Wilaya>> {
  return api.get<CountedList<Wilaya>>("/admin/wilayas", { query });
}

export async function getWilaya(code: number | string): Promise<Wilaya> {
  return (await api.get<DataResponse<Wilaya>>(`/admin/wilayas/${code}`)).data;
}

export async function updateWilaya(
  code: number | string,
  body: { isOpen?: boolean; name?: string; nameAr?: string; confirm?: boolean },
): Promise<Wilaya> {
  return (await api.patch<DataResponse<Wilaya>>(`/admin/wilayas/${code}`, body)).data;
}

/* ------------------------------------------------------------------ communes */

export interface Commune {
  id: string;
  wilayaCode: number;
  name: string;
  nameAr: string;
  postalCode: string | null;
  bookingsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommuneBody {
  name: string;
  nameAr: string;
  postalCode?: string | null;
}

export interface CommunesImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export function listCommunes(code: number | string, query: QueryParams) {
  return api.get<CountedList<Commune>>(`/admin/wilayas/${code}/communes`, { query });
}

export async function createCommune(body: CommuneBody & { wilayaCode: number }): Promise<Commune> {
  return (await api.post<DataResponse<Commune>>("/admin/communes", body)).data;
}

export async function updateCommune(id: string, body: Partial<CommuneBody>): Promise<Commune> {
  return (await api.patch<DataResponse<Commune>>(`/admin/communes/${id}`, body)).data;
}

export function deleteCommune(id: string) {
  return api.delete<void>(`/admin/communes/${id}`);
}

export async function importCommunes(file: File): Promise<CommunesImportResult> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<DataResponse<CommunesImportResult>>("/admin/communes/import", form)).data;
}

export const communesTemplateUrl = () => buildUrl("/admin/communes/import/template");

/** Downloads the CSV template with the auth header (a plain link can't send the bearer token). */
export async function downloadCommunesTemplate() {
  const { tokenStore } = await import("./token");
  const res = await fetch(communesTemplateUrl(), {
    credentials: "include",
    headers: tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {},
  });
  if (!res.ok) throw new Error(res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "communes-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
