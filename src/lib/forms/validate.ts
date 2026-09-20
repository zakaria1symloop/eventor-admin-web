/**
 * Client-side answer validation for the public form (ACR-07), mirroring
 * `backend/src/academic/form-answers.ts` so errors show before the API refuses the submission
 * (422 FORM_ANSWERS_INVALID uses the same codes).
 */
import { FILE_MIME, FILE_TYPES, isDisplay, type FileExt, type FormField, type FormSchema } from "./schema";

export type Answers = Record<string, unknown>;

export interface AnswerFile {
  mimeType: string;
  sizeBytes: number;
}

export interface AnswerIssue {
  fieldKey: string;
  code: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(\+[1-9]\d{7,14}|0[5-7]\d{8}|0[2-4]\d{7})$/;

export const isEmptyAnswer = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in Africa/Algiers (`YYYY-MM-DD`). */
export function algiersToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(now);
}

/** Keys of the fields currently shown (showIf evaluated in order, hidden parents hide children). */
export function visibleKeys(schema: FormSchema, answers: Answers): Set<string> {
  const shown = new Set<string>();
  for (const field of schema.fields) {
    if (isShown(field, answers, shown)) shown.add(field.key);
  }
  return shown;
}

export function isShown(field: FormField, answers: Answers, shown: ReadonlySet<string>): boolean {
  const c = field.showIf;
  if (!c?.field) return true;
  if (!shown.has(c.field)) return false;
  const value = answers[c.field];
  if (c.notEmpty) return !isEmptyAnswer(value) && value !== false;
  const matches = (candidate: unknown) =>
    Array.isArray(value) ? value.includes(candidate) : value === candidate;
  if (c.equals !== undefined) return matches(c.equals);
  if (Array.isArray(c.in)) return c.in.some(matches);
  return true;
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Validates one field's answer; returns the API error code or null. */
export function validateField(
  field: FormField,
  value: unknown,
  ctx: { today: string; files?: AnswerFile[]; maxUploadMb?: number },
): string | null {
  if (isDisplay(field.type)) return null;
  const v = field.validation ?? {};

  if (field.type === "file") {
    const files = ctx.files ?? [];
    if (files.length === 0) return field.required ? "REQUIRED" : null;
    if (files.length > (v.maxFiles ?? 1)) return "TOO_MANY_FILES";
    const types = (v.types ?? [...FILE_TYPES]).map((t) => FILE_MIME[t as FileExt]);
    if (files.some((f) => !types.includes(f.mimeType))) return "FILE_TYPE_NOT_ALLOWED";
    const limit = Math.min(v.maxSizeMb ?? ctx.maxUploadMb ?? Infinity, ctx.maxUploadMb ?? Infinity);
    if (files.some((f) => f.sizeBytes > limit * 1024 * 1024)) return "FILE_TOO_LARGE";
    return null;
  }

  const val = typeof value === "string" ? value.trim() : value;
  if (isEmptyAnswer(val) || (field.type === "consent" && val === false)) {
    if (!field.required) return null;
    return field.type === "consent" ? "CONSENT_REQUIRED" : "REQUIRED";
  }

  switch (field.type) {
    case "short_text":
    case "long_text": {
      if (typeof val !== "string") return "TYPE_INVALID";
      const max = v.maxLength ?? (field.type === "short_text" ? 190 : 5000);
      if (typeof v.minLength === "number" && val.length < v.minLength) return "TOO_SHORT";
      if (val.length > max) return "TOO_LONG";
      if (typeof v.pattern === "string") {
        try {
          if (!new RegExp(v.pattern, "u").test(val)) return "PATTERN_MISMATCH";
        } catch {
          return null;
        }
      }
      return null;
    }
    case "email":
      return typeof val === "string" && EMAIL.test(val) && val.length <= 190 ? null : "EMAIL_INVALID";
    case "phone":
      return typeof val === "string" && PHONE.test(val.replace(/[\s.-]/g, "")) ? null : "PHONE_INVALID";
    case "number":
      if (typeof val !== "number" || !Number.isFinite(val)) return "TYPE_INVALID";
      if (v.integer && !Number.isInteger(val)) return "NOT_INTEGER";
      if (typeof v.min === "number" && val < v.min) return "BELOW_MIN";
      if (typeof v.max === "number" && val > v.max) return "ABOVE_MAX";
      return null;
    case "single_choice":
    case "dropdown":
      return field.options?.some((o) => o.value === val) ? null : "OPTION_INVALID";
    case "multi_choice":
    case "service_categories": {
      if (!Array.isArray(val)) return "TYPE_INVALID";
      const unique = [...new Set(val as string[])];
      if (field.type === "multi_choice" && unique.some((x) => !field.options?.some((o) => o.value === x)))
        return "OPTION_INVALID";
      if (typeof v.minSelected === "number" && unique.length < v.minSelected) return "TOO_FEW";
      if (typeof v.maxSelected === "number" && unique.length > v.maxSelected) return "TOO_MANY";
      return null;
    }
    case "date":
      if (typeof val !== "string" || !validDate(val)) return "DATE_INVALID";
      if (typeof v.minOffsetDays === "number" && val < addDays(ctx.today, v.minOffsetDays))
        return "DATE_TOO_EARLY";
      if (typeof v.maxOffsetDays === "number" && val > addDays(ctx.today, v.maxOffsetDays))
        return "DATE_TOO_LATE";
      return null;
    case "time_range": {
      const t = val as { start?: string; end?: string };
      if (!t?.start || !t?.end) return field.required ? "REQUIRED" : null;
      if (!TIME.test(t.start) || !TIME.test(t.end) || t.end <= t.start) return "TIME_RANGE_INVALID";
      return null;
    }
    case "wilaya":
      return Number.isInteger(val) && (val as number) >= 1 && (val as number) <= 58 ? null : "WILAYA_INVALID";
    case "budget_range": {
      const b = val as { min?: number | null; max?: number | null };
      const num = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0;
      if (b?.min == null && b?.max == null) return field.required ? "REQUIRED" : null;
      if (!num(b.min) || !num(b.max) || (b.min as number) > (b.max as number)) return "BUDGET_INVALID";
      if (typeof v.min === "number" && (b.min as number) < v.min) return "BELOW_MIN";
      if (typeof v.max === "number" && (b.max as number) > v.max) return "ABOVE_MAX";
      return null;
    }
    case "consent":
      return val === true ? null : "CONSENT_REQUIRED";
    default:
      return null;
  }
}

/** Validates the visible fields (optionally only `keys`, e.g. the current step). */
export function validateAnswers(
  schema: FormSchema,
  answers: Answers,
  ctx: { today: string; files?: Record<string, AnswerFile[]>; maxUploadMb?: number; keys?: string[] },
): AnswerIssue[] {
  const shown = visibleKeys(schema, answers);
  const issues: AnswerIssue[] = [];
  for (const field of schema.fields) {
    if (!shown.has(field.key) || isDisplay(field.type)) continue;
    if (ctx.keys && !ctx.keys.includes(field.key)) continue;
    const code = validateField(field, answers[field.key], {
      today: ctx.today,
      files: ctx.files?.[field.key],
      maxUploadMb: ctx.maxUploadMb,
    });
    if (code) issues.push({ fieldKey: field.key, code });
  }
  return issues;
}

/** Answers to send: visible input fields only, strings trimmed, empty values dropped, files excluded. */
export function cleanAnswers(schema: FormSchema, answers: Answers): Answers {
  const shown = visibleKeys(schema, answers);
  const out: Answers = {};
  for (const field of schema.fields) {
    if (!shown.has(field.key) || isDisplay(field.type) || field.type === "file") continue;
    let value = answers[field.key];
    if (typeof value === "string") value = value.trim();
    if (field.type === "phone" && typeof value === "string") value = value.replace(/[\s.-]/g, "");
    if (isEmptyAnswer(value) || (field.type === "consent" && value !== true)) continue;
    if (field.type === "budget_range") {
      const b = value as { min?: number | null; max?: number | null };
      if (b.min == null && b.max == null) continue;
    }
    if (field.type === "time_range") {
      const t = value as { start?: string; end?: string };
      if (!t.start && !t.end) continue;
    }
    out[field.key] = value;
  }
  return out;
}
