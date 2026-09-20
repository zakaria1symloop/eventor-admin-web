/**
 * Dynamic form schema (db-schema §7, ACR-06 builder). Mirrors `backend/src/academic/form-schema.ts`:
 * 17 field types, system mappings (each once, on a compatible type), validation keys per type,
 * `showIf { field, equals | in | notEmpty }` on an earlier field, `section` = key of a section field.
 * Pure functions: used by the builder, the preview and the public renderer.
 */

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "single_choice",
  "multi_choice",
  "dropdown",
  "date",
  "time_range",
  "wilaya",
  "service_categories",
  "budget_range",
  "file",
  "section",
  "info",
  "consent",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const MAPPABLE_FIELDS = [
  "title",
  "event_type",
  "event_date",
  "wilaya",
  "attendees",
  "institution_name",
  "needs",
  "budget",
  "requester_name",
  "requester_phone",
] as const;
export type MappableField = (typeof MAPPABLE_FIELDS)[number];

/** Needed before publish (422 MAPPING_REQUIRED). */
export const REQUIRED_MAPPINGS: readonly MappableField[] = [
  "title",
  "event_date",
  "wilaya",
  "requester_name",
  "requester_phone",
];

export const MAPPING_TYPES: Record<MappableField, readonly FieldType[]> = {
  title: ["short_text"],
  institution_name: ["short_text"],
  event_type: ["single_choice", "dropdown"],
  event_date: ["date"],
  wilaya: ["wilaya"],
  attendees: ["number"],
  needs: ["service_categories"],
  budget: ["budget_range"],
  requester_name: ["short_text"],
  requester_phone: ["phone"],
};

export const CHOICE_TYPES: readonly FieldType[] = ["single_choice", "multi_choice", "dropdown"];
export const DISPLAY_TYPES: readonly FieldType[] = ["section", "info"];
export const FILE_TYPES = ["pdf", "jpg", "png"] as const;
export type FileExt = (typeof FILE_TYPES)[number];
export const FILE_MIME: Record<FileExt, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

/** Palette groups (Figma ACR-06). */
export const PALETTE: { group: "basic" | "choice" | "event" | "other"; types: FieldType[] }[] = [
  { group: "basic", types: ["short_text", "long_text", "number", "email", "phone"] },
  { group: "choice", types: ["single_choice", "multi_choice", "dropdown"] },
  { group: "event", types: ["date", "time_range", "wilaya", "service_categories", "budget_range"] },
  { group: "other", types: ["file", "section", "info", "consent"] },
];

export interface FieldOption {
  value: string;
  label_en: string;
  label_ar: string;
}

export interface ShowIf {
  field: string;
  equals?: string | number | boolean;
  in?: string[];
  notEmpty?: true;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  minSelected?: number;
  maxSelected?: number;
  minOffsetDays?: number;
  maxOffsetDays?: number;
  maxFiles?: number;
  types?: FileExt[];
  maxSizeMb?: number;
}

export interface FormField {
  key: string;
  type: FieldType;
  label_en: string;
  label_ar: string;
  help_en?: string;
  help_ar?: string;
  required?: boolean;
  options?: FieldOption[];
  validation?: FieldValidation;
  showIf?: ShowIf;
  section?: string;
  maps_to?: MappableField;
}

export interface FormSchema {
  fields: FormField[];
}

export interface SchemaIssue {
  path: string;
  code: string;
}

/** Validation keys allowed per type (others are refused by the API). */
export const VALIDATION_KEYS: Partial<Record<FieldType, (keyof FieldValidation)[]>> = {
  short_text: ["minLength", "maxLength", "pattern"],
  long_text: ["minLength", "maxLength", "pattern"],
  number: ["min", "max", "integer"],
  multi_choice: ["minSelected", "maxSelected"],
  service_categories: ["minSelected", "maxSelected"],
  date: ["minOffsetDays", "maxOffsetDays"],
  budget_range: ["min", "max"],
  file: ["maxFiles", "types", "maxSizeMb"],
};

export const isDisplay = (type: FieldType) => DISPLAY_TYPES.includes(type);
export const isChoice = (type: FieldType) => CHOICE_TYPES.includes(type);

/* ------------------------------------------------------------------ builder operations */

const KEY = /^[a-z][a-z0-9_]{0,59}$/;

/** `event_title`, `event_title_2`… unique within the schema. */
export function uniqueKey(schema: FormSchema, base: string): string {
  const clean =
    base
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+/, "")
      .replace(/_+$/g, "")
      .slice(0, 50) || "field";
  const keys = new Set(schema.fields.map((f) => f.key));
  if (!keys.has(clean)) return clean;
  let n = 2;
  while (keys.has(`${clean}_${n}`)) n += 1;
  return `${clean}_${n}`;
}

export const isValidKey = (key: string) => KEY.test(key);

/** A new field of `type` with empty labels (EN/AR filled by the admin). */
export function newField(
  schema: FormSchema,
  type: FieldType,
  labels?: { en: string; ar: string },
): FormField {
  const field: FormField = {
    key: uniqueKey(schema, type),
    type,
    label_en: labels?.en ?? "",
    label_ar: labels?.ar ?? "",
  };
  if (isChoice(type)) {
    field.options = [
      { value: "option_1", label_en: "", label_ar: "" },
      { value: "option_2", label_en: "", label_ar: "" },
    ];
  }
  if (type === "file") field.validation = { maxFiles: 1, types: ["pdf", "jpg", "png"], maxSizeMb: 5 };
  return field;
}

/** Section of the field at `index` (the nearest section above, or its own `section`). */
export function sectionAt(schema: FormSchema, index: number): string | undefined {
  for (let i = Math.min(index, schema.fields.length - 1); i >= 0; i -= 1) {
    if (schema.fields[i].type === "section") return schema.fields[i].key;
  }
  return undefined;
}

/** Re-derives each field's `section` from its position (sections own the fields below them). */
export function normalizeSections(fields: FormField[]): FormField[] {
  let current: string | undefined;
  return fields.map((f) => {
    if (f.type === "section") {
      current = f.key;
      if (f.section === undefined) return f;
      const { section: _drop, ...rest } = f;
      void _drop;
      return rest;
    }
    if (f.section === current) return f;
    const next = { ...f };
    if (current) next.section = current;
    else delete next.section;
    return next;
  });
}

/** Removes showIf conditions that no longer point to an earlier, conditionable field. */
function pruneShowIf(fields: FormField[]): FormField[] {
  const seen = new Map<string, FieldType>();
  return fields.map((f) => {
    let next = f;
    if (f.showIf) {
      const target = seen.get(f.showIf.field);
      if (!target || !isConditionTarget(target)) {
        const { showIf: _drop, ...rest } = f;
        void _drop;
        next = rest;
      }
    }
    seen.set(f.key, f.type);
    return next;
  });
}

const finish = (fields: FormField[]): FormSchema => ({ fields: pruneShowIf(normalizeSections(fields)) });

export function addField(schema: FormSchema, field: FormField, index = schema.fields.length): FormSchema {
  const fields = [...schema.fields];
  fields.splice(Math.max(0, Math.min(index, fields.length)), 0, field);
  return finish(fields);
}

export function moveField(schema: FormSchema, from: number, to: number): FormSchema {
  if (from === to || from < 0 || to < 0 || from >= schema.fields.length || to >= schema.fields.length)
    return schema;
  const fields = [...schema.fields];
  const [it] = fields.splice(from, 1);
  fields.splice(to, 0, it);
  return finish(fields);
}

export function removeField(schema: FormSchema, key: string): FormSchema {
  return finish(schema.fields.filter((f) => f.key !== key));
}

export function updateField(schema: FormSchema, key: string, patch: Partial<FormField>): FormSchema {
  const fields = schema.fields.map((f) => {
    if (f.key !== key) return f;
    const next: FormField = { ...f, ...patch };
    for (const k of Object.keys(patch) as (keyof FormField)[]) {
      if (patch[k] === undefined) delete next[k];
    }
    return next;
  });
  // A renamed key: follow showIf references.
  if (patch.key && patch.key !== key) {
    for (const f of fields) {
      if (f.showIf?.field === key) f.showIf = { ...f.showIf, field: patch.key };
    }
  }
  return finish(fields);
}

/* ------------------------------------------------------------------ mappings */

/** Options for a field's "maps to" select: used elsewhere or incompatible targets are disabled. */
export function mappingOptions(schema: FormSchema, field: FormField) {
  return MAPPABLE_FIELDS.map((target) => {
    const owner = schema.fields.find((f) => f.maps_to === target && f.key !== field.key);
    const compatible = MAPPING_TYPES[target].includes(field.type);
    return { value: target, usedBy: owner?.key ?? null, compatible, disabled: !!owner || !compatible };
  });
}

export function missingMappings(schema: FormSchema): MappableField[] {
  const mapped = new Set(schema.fields.map((f) => f.maps_to).filter(Boolean));
  return REQUIRED_MAPPINGS.filter((m) => !mapped.has(m));
}

/* ------------------------------------------------------------------ showIf */

export const isConditionTarget = (type: FieldType) => !["section", "info", "file"].includes(type);

export type ShowIfOperator = "equals" | "in" | "notEmpty";

/** Fields a showIf on `field` may point to: earlier input fields (not section / info / file). */
export function showIfTargets(schema: FormSchema, key: string): FormField[] {
  const index = schema.fields.findIndex((f) => f.key === key);
  return schema.fields.slice(0, Math.max(index, 0)).filter((f) => isConditionTarget(f.type));
}

/** Operators that make sense for the target type. */
export function showIfOperators(target: FormField | undefined): ShowIfOperator[] {
  if (!target) return [];
  if (isChoice(target.type)) return ["equals", "in", "notEmpty"];
  if (target.type === "consent") return ["equals"];
  return ["equals", "notEmpty"];
}

export function showIfOperator(showIf: ShowIf | undefined): ShowIfOperator | null {
  if (!showIf) return null;
  if (showIf.notEmpty) return "notEmpty";
  if (Array.isArray(showIf.in)) return "in";
  return "equals";
}

/* ------------------------------------------------------------------ translations & structure */

/** Every EN and AR label (field and option) must be filled to publish. */
export function missingTranslations(schema: FormSchema, lang?: "en" | "ar"): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const langs = lang ? [lang] : (["en", "ar"] as const);
  schema.fields.forEach((field, i) => {
    for (const l of langs) {
      if (!field[`label_${l}`]?.trim())
        issues.push({ path: `fields[${i}].label_${l}`, code: "TRANSLATION_MISSING" });
    }
    field.options?.forEach((option, j) => {
      for (const l of langs) {
        if (!option[`label_${l}`]?.trim())
          issues.push({ path: `fields[${i}].options[${j}].label_${l}`, code: "TRANSLATION_MISSING" });
      }
    });
  });
  return issues;
}

/** Client-side mirror of the draft checks, shown in the builder before saving. */
export function schemaIssues(schema: FormSchema, { publish = false } = {}): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const add = (path: string, code: string) => issues.push({ path, code });
  const seen = new Map<string, FieldType>();
  const mapped = new Set<string>();
  const sections = new Set(schema.fields.filter((f) => f.type === "section").map((f) => f.key));
  schema.fields.forEach((f, i) => {
    const p = `fields[${i}]`;
    if (!isValidKey(f.key)) add(`${p}.key`, "KEY_INVALID");
    else if (seen.has(f.key)) add(`${p}.key`, "KEY_DUPLICATE");
    if (f.required && isDisplay(f.type)) add(`${p}.required`, "REQUIRED_NOT_ALLOWED");
    if (isChoice(f.type)) {
      if (!f.options?.length) add(`${p}.options`, "OPTIONS_REQUIRED");
      const values = new Set<string>();
      f.options?.forEach((o, j) => {
        if (!o.value || o.value.length > 60) add(`${p}.options[${j}].value`, "OPTION_VALUE_INVALID");
        else if (values.has(o.value)) add(`${p}.options[${j}].value`, "OPTION_VALUE_DUPLICATE");
        values.add(o.value);
      });
    }
    const v = f.validation;
    if (v) {
      if (v.pattern !== undefined) {
        try {
          new RegExp(v.pattern, "u");
        } catch {
          add(`${p}.validation.pattern`, "PATTERN_INVALID");
        }
      }
      for (const [a, b] of [
        ["minLength", "maxLength"],
        ["min", "max"],
        ["minSelected", "maxSelected"],
        ["minOffsetDays", "maxOffsetDays"],
      ] as const) {
        if (typeof v[a] === "number" && typeof v[b] === "number" && (v[a] as number) > (v[b] as number))
          add(`${p}.validation`, "VALIDATION_RANGE_INVALID");
      }
      if (f.type === "file" && v.maxFiles !== undefined && (v.maxFiles < 1 || v.maxFiles > 10))
        add(`${p}.validation.maxFiles`, "VALIDATION_INVALID");
    }
    if (f.showIf) {
      const target = seen.get(f.showIf.field);
      if (!target || !isConditionTarget(target)) add(`${p}.showIf.field`, "SHOW_IF_FIELD_UNKNOWN");
    }
    if (f.section && (!sections.has(f.section) || f.type === "section"))
      add(`${p}.section`, "SECTION_INVALID");
    if (f.maps_to) {
      if (mapped.has(f.maps_to)) add(`${p}.maps_to`, "MAPPING_DUPLICATE");
      else if (!MAPPING_TYPES[f.maps_to].includes(f.type)) add(`${p}.maps_to`, "MAPPING_TYPE_MISMATCH");
      mapped.add(f.maps_to);
    }
    seen.set(f.key, f.type);
  });
  if (publish) {
    for (const m of missingMappings(schema)) add(`fields.maps_to.${m}`, "MAPPING_REQUIRED");
    if (schema.fields.every((f) => isDisplay(f.type))) add("fields", "NO_INPUT_FIELDS");
  }
  return issues;
}

/** `fields[3].options[0].label_ar` → field index 3 (null for form-level paths). */
export function issueFieldIndex(path: string): number | null {
  const m = /^fields\[(\d+)\]/.exec(path);
  return m ? Number(m[1]) : null;
}

/** Issues grouped by field key (for the canvas badges and the settings panel). */
export function issuesByField(schema: FormSchema, issues: SchemaIssue[]): Record<string, SchemaIssue[]> {
  const out: Record<string, SchemaIssue[]> = {};
  for (const issue of issues) {
    const i = issueFieldIndex(issue.path);
    const key = i !== null ? schema.fields[i]?.key : undefined;
    if (!key) continue;
    (out[key] ??= []).push(issue);
  }
  return out;
}

/** Tolerant parse of an API schema (`draftSchema`, public `schema`). */
export function toSchema(raw: unknown): FormSchema {
  if (raw && typeof raw === "object" && Array.isArray((raw as FormSchema).fields)) {
    return { fields: (raw as FormSchema).fields };
  }
  return { fields: [] };
}

/** Steps of the public form: one per section (fields before the first section form their own step). */
export function formSteps(schema: FormSchema): { section: FormField | null; fields: FormField[] }[] {
  const steps: { section: FormField | null; fields: FormField[] }[] = [];
  for (const f of schema.fields) {
    if (f.type === "section") steps.push({ section: f, fields: [] });
    else {
      if (steps.length === 0) steps.push({ section: null, fields: [] });
      steps[steps.length - 1].fields.push(f);
    }
  }
  return steps.filter((s) => s.section || s.fields.length > 0);
}

export const fieldLabel = (f: { label_en: string; label_ar: string }, locale: string) =>
  locale === "ar" ? f.label_ar || f.label_en : f.label_en || f.label_ar;
export const fieldHelp = (f: FormField, locale: string) =>
  (locale === "ar" ? f.help_ar || f.help_en : f.help_en || f.help_ar) || undefined;
