import type { LineItem } from "@/components/forms/editors";
import type { PhotoItem } from "@/components/forms/photo-uploader";
import { ApiError } from "@/lib/api/errors";
import {
  publishMissing,
  servicePublishErrors,
  type CreateServiceBody,
  type Photo,
  type PriceType,
  type ServiceDetail,
  type ServiceHour,
  type ServicePublishField,
} from "@/lib/api/services";

export interface FactRow {
  id: string;
  label_en: string;
  label_ar: string;
  value_en: string;
  value_ar: string;
}

export interface ServiceFormValues {
  text: Record<string, string>; // title_en/ar, description_en/ar, policy_en/ar
  facts: FactRow[];
  basePrice: number | null;
  priceType: PriceType;
  /** "Only one booking per day": ticked = 1 a day, unticked = no daily limit. */
  onePerDay: boolean;
  maxGuests: number | null;
  /** Different clients who may book overlapping hours. */
  concurrentClients: number | null;
  /** Event dates the service can be booked for ("" = no limit). */
  availableFrom: string;
  availableUntil: string;
  /** Off = bookable at any hour (hours sent as []). */
  hoursEnabled: boolean;
  hours: ServiceHour[];
  extras: LineItem[];
  wilayaCodes: string[];
  categoryId: string;
  published: boolean;
  featured: boolean;
}

/** Order the form shows fields in (first error = scroll target). */
export const FIELD_ORDER = [
  "providerId",
  "title_en",
  "title_ar",
  "description_en",
  "description_ar",
  "policy_en",
  "policy_ar",
  "facts",
  "basePrice",
  "priceType",
  "extras",
  "photos",
  "categoryId",
  "wilayaCodes",
  "onePerDay",
  "maxGuests",
  "concurrentClients",
  "availablePeriod",
  "hours",
] as const;

let seq = 0;
const rowId = (p: string) => `${p}-${++seq}`;

export function emptyServiceValues(): ServiceFormValues {
  return {
    text: {
      title_en: "",
      title_ar: "",
      description_en: "",
      description_ar: "",
      policy_en: "",
      policy_ar: "",
    },
    facts: [],
    basePrice: null,
    priceType: "per_event",
    onePerDay: true,
    maxGuests: null,
    concurrentClients: 1,
    availableFrom: "",
    availableUntil: "",
    hoursEnabled: false,
    hours: [],
    extras: [],
    wilayaCodes: [],
    categoryId: "",
    published: false,
    featured: false,
  };
}

export function serviceToValues(s: ServiceDetail): ServiceFormValues {
  return {
    text: {
      title_en: s.titleEn ?? "",
      title_ar: s.titleAr ?? "",
      description_en: s.descriptionEn ?? "",
      description_ar: s.descriptionAr ?? "",
      policy_en: s.cancellationPolicyEn ?? "",
      policy_ar: s.cancellationPolicyAr ?? "",
    },
    facts: s.facts.map((f) => ({ id: rowId("fact"), ...f })),
    basePrice: Number(s.basePrice),
    priceType: s.priceType,
    onePerDay: s.onePerDay,
    maxGuests: s.maxGuests,
    concurrentClients: s.concurrentClients,
    availableFrom: s.availableFrom ?? "",
    availableUntil: s.availableUntil ?? "",
    hoursEnabled: s.hours.length > 0,
    hours: s.hours,
    extras: s.extras.map((x) => ({ id: x.id, label: x.nameEn, labelAr: x.nameAr, amount: Number(x.price) })),
    wilayaCodes: s.wilayaDetails.map((w) => String(w.code)),
    categoryId: s.category.id,
    published: s.status === "published",
    featured: s.isFeatured,
  };
}

/** Comparable snapshot for the dirty check (row ids ignored). */
export function snapshot(v: ServiceFormValues) {
  return JSON.stringify({
    ...v,
    facts: v.facts.map((f) => ({ ...f, id: "" })),
    extras: v.extras.map((x) => ({ ...x, id: "" })),
  });
}

export function valuesToBody(v: ServiceFormValues): Omit<CreateServiceBody, "providerId"> {
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  return {
    categoryId: v.categoryId,
    titleEn: v.text.title_en.trim(),
    titleAr: v.text.title_ar.trim(),
    descriptionEn: v.text.description_en.trim(),
    descriptionAr: v.text.description_ar.trim(),
    cancellationPolicyEn: nul(v.text.policy_en),
    cancellationPolicyAr: nul(v.text.policy_ar),
    facts: v.facts
      .filter((f) => f.label_en.trim() || f.label_ar.trim() || f.value_en.trim() || f.value_ar.trim())
      .map(({ label_en, label_ar, value_en, value_ar }) => ({
        label_en: label_en.trim(),
        label_ar: label_ar.trim(),
        value_en: value_en.trim(),
        value_ar: value_ar.trim(),
      })),
    basePrice: String(v.basePrice ?? 0),
    priceType: v.priceType,
    onePerDay: v.onePerDay,
    maxGuests: v.maxGuests,
    concurrentClients: v.concurrentClients ?? 1,
    availableFrom: v.availableFrom || null,
    availableUntil: v.availableUntil || null,
    hours: v.hoursEnabled ? v.hours : [],
    wilayaCodes: v.wilayaCodes.map(Number),
    extras: v.extras
      .filter((x) => x.label.trim() || (x.labelAr ?? "").trim() || x.amount !== null)
      .map((x) => ({
        nameEn: x.label.trim(),
        nameAr: (x.labelAr ?? "").trim(),
        price: String(x.amount ?? 0),
      })),
  };
}

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Checks needed before any save (API required fields for a draft). Keys are form fields. */
export function validateDraft(v: ServiceFormValues, t: Translate, providerId: string | null) {
  const errors: Record<string, string> = {};
  if (!providerId) errors.providerId = t("errors.provider");
  if (!v.text.title_en.trim()) errors.title_en = t("errors.titleEn");
  if (v.basePrice === null || v.basePrice < 0) errors.basePrice = t("errors.price");
  if (!v.categoryId) errors.categoryId = t("errors.category");
  if (v.concurrentClients !== null && (v.concurrentClients < 1 || v.concurrentClients > 50))
    errors.concurrentClients = t("errors.concurrentClients");
  if (v.availableFrom && v.availableUntil && v.availableUntil < v.availableFrom)
    errors.availablePeriod = t("errors.availablePeriod");
  if (v.hoursEnabled && v.hours.length === 0) errors.hours = t("errors.hoursEmpty");
  if (v.hoursEnabled && v.hours.some((h) => h.startTime === h.endTime)) errors.hours = t("errors.hoursSameTime");
  v.extras.forEach((x) => {
    if (!x.label.trim() || !(x.labelAr ?? "").trim() || x.amount === null)
      errors[`extra:${x.id}`] = t("errors.extra");
  });
  if (v.extras.some((x) => errors[`extra:${x.id}`])) errors.extras = t("errors.extra");
  return errors;
}

/** Message per SERVICE_PUBLISH_INVALID `details.missing` key. */
export function publishErrorsToFields(missing: string[], t: Translate): Record<string, string> {
  const map = servicePublishErrors(missing);
  return Object.fromEntries(
    Object.entries(map).map(([field, key]) => [field, t(`publishErrors.${key as ServicePublishField}`)]),
  );
}

const API_FIELD: Record<string, string> = {
  titleEn: "title_en",
  titleAr: "title_ar",
  descriptionEn: "description_en",
  descriptionAr: "description_ar",
  cancellationPolicyEn: "policy_en",
  cancellationPolicyAr: "policy_ar",
  basePrice: "basePrice",
  priceType: "priceType",
  categoryId: "categoryId",
  providerId: "providerId",
  wilayaCodes: "wilayaCodes",
  maxEventsPerDay: "onePerDay",
  onePerDay: "onePerDay",
  maxGuests: "maxGuests",
  concurrentClients: "concurrentClients",
  availableFrom: "availablePeriod",
  availableUntil: "availablePeriod",
  hours: "hours",
  extras: "extras",
  facts: "facts",
};

/** Any save error → `{ field: message }` (empty when it isn't field-shaped: show a banner instead). */
export function apiErrorToFields(error: unknown, t: Translate): Record<string, string> {
  const missing = publishMissing(error, "SERVICE_PUBLISH_INVALID");
  if (missing) return publishErrorsToFields(missing, t);
  if (!(error instanceof ApiError)) return {};
  switch (error.code) {
    case "CATEGORY_HIDDEN":
      return { categoryId: error.message };
    case "WILAYA_CLOSED":
      return { wilayaCodes: error.message };
    case "NOT_A_PROVIDER":
    case "SERVICE_IN_PACKS":
      return { providerId: error.message };
  }
  const out: Record<string, string> = {};
  for (const d of error.fieldErrors) {
    const root = d.field.split(/[.[]/)[0];
    out[API_FIELD[root] ?? root] = d.message;
  }
  return out;
}

/** First field with an error, in form order. */
export function firstErrorField(errors: Record<string, unknown>): string | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? Object.keys(errors)[0] ?? null;
}

/** Which language tab should be open so the first bilingual error is visible. */
export function langForErrors(errors: Record<string, unknown>): "en" | "ar" {
  const keys = Object.keys(errors);
  if (keys.some((k) => /_en$/.test(k))) return "en";
  return keys.some((k) => /_ar$/.test(k)) ? "ar" : "en";
}

export function photoToItem(p: Photo): PhotoItem {
  return {
    id: p.id,
    url: p.thumbUrl || p.url,
    status:
      p.processingStatus === "pending" ? "processing" : p.processingStatus === "failed" ? "failed" : "ready",
  };
}

/** Server ids removed and whether the remaining server photos were reordered. */
export function diffPhotos(prev: PhotoItem[], next: PhotoItem[]) {
  const isServer = (p: PhotoItem) => !p.id.startsWith("tmp-") && p.status !== "uploading";
  const nextIds = new Set(next.map((p) => p.id));
  const removed = prev.filter((p) => isServer(p) && !nextIds.has(p.id)).map((p) => p.id);
  const before = prev.filter((p) => isServer(p) && nextIds.has(p.id)).map((p) => p.id);
  const after = next.filter((p) => isServer(p) && before.includes(p.id)).map((p) => p.id);
  const reordered = removed.length === 0 && before.join() !== after.join();
  return { removed, reordered, order: next.filter(isServer).map((p) => p.id) };
}

/** Copy of `obj` without `key` (clears one field error). */
export function omitKey<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}
