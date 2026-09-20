"use client";

import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { toast } from "@/components/feedback/toast";
import { Checkbox, Field, Select, TextInput, Textarea, Toggle } from "@/components/forms/fields";
import { NumberInput } from "@/components/forms/inputs";
import { MultiSelect } from "@/components/forms/select-inputs";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";
import { updateForm, type FormDetail, type UpdateFormBody } from "@/lib/api/forms";
import {
  FILE_TYPES,
  fieldLabel,
  isChoice,
  isDisplay,
  isValidKey,
  mappingOptions,
  showIfOperator,
  showIfOperators,
  showIfTargets,
  VALIDATION_KEYS,
  type FieldOption,
  type FieldValidation,
  type FileExt,
  type FormField,
  type FormSchema,
  type SchemaIssue,
  type ShowIfOperator,
} from "@/lib/forms/schema";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

/** Translated schema issue ("fields[2].options[0].label_ar" → "Option 1 · Arabic label missing"). */
export function useIssueText() {
  const t = useTranslations("academic.builder.issues");
  return (issue: SchemaIssue) => {
    const option = /options\[(\d+)\]/.exec(issue.path);
    const text = t.has(issue.code) ? t(issue.code) : issue.code;
    const target = /label_(en|ar)$/.exec(issue.path)?.[1];
    return [
      option ? t("option", { n: Number(option[1]) + 1 }) : null,
      target ? t(`lang.${target}`) : null,
      text,
    ]
      .filter(Boolean)
      .join(" · ");
  };
}

const rtl = "font-arabic text-start";

/* ------------------------------------------------------------------ field settings */

export function FieldSettings({
  schema,
  field,
  issues,
  onChange,
  onRemove,
}: {
  schema: FormSchema;
  field: FormField;
  issues: SchemaIssue[];
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("academic.builder");
  const issueText = useIssueText();
  const has = (suffix: RegExp) => issues.find((i) => suffix.test(i.path));
  const err = (suffix: RegExp) => {
    const i = has(suffix);
    return i ? issueText(i) : undefined;
  };
  const [keyDraft, setKeyDraft] = useState(field.key);
  const [keyFor, setKeyFor] = useState(field.key);
  if (keyFor !== field.key) {
    setKeyFor(field.key);
    setKeyDraft(field.key);
  }
  const keyTaken = keyDraft !== field.key && schema.fields.some((f) => f.key === keyDraft);
  const keyError = !isValidKey(keyDraft) ? t("keyInvalid") : keyTaken ? t("keyTaken") : err(/\.key$/);
  const display = isDisplay(field.type);

  return (
    <Card>
      <CardHeader
        title={t("fieldSettings", { name: fieldLabel(field, "en") || t(`types.${field.type}`) })}
        subtitle={t(`types.${field.type}`)}
        actions={
          <IconButton label={t("removeField")} size="sm" onClick={onRemove}>
            <Trash2 />
          </IconButton>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <Field
          label={t("labelEn")}
          required={!display || field.type === "section"}
          error={err(/^fields\[\d+\]\.label_en$/)}
        >
          <TextInput
            value={field.label_en}
            maxLength={500}
            onChange={(e) => onChange({ label_en: e.target.value })}
          />
        </Field>
        <Field
          label={t("labelAr")}
          required={!display || field.type === "section"}
          error={
            err(/^fields\[\d+\]\.label_ar$/) ?? (!field.label_ar.trim() ? t("arabicMissing") : undefined)
          }
        >
          <TextInput
            dir="rtl"
            lang="ar"
            className={rtl}
            value={field.label_ar}
            maxLength={500}
            onChange={(e) => onChange({ label_ar: e.target.value })}
          />
        </Field>
        <Field label={field.type === "info" ? t("textEn") : t("helpEn")}>
          {field.type === "info" ? (
            <Textarea
              value={field.help_en ?? ""}
              maxLength={2000}
              onChange={(e) => onChange({ help_en: e.target.value || undefined })}
            />
          ) : (
            <TextInput
              value={field.help_en ?? ""}
              maxLength={2000}
              onChange={(e) => onChange({ help_en: e.target.value || undefined })}
            />
          )}
        </Field>
        <Field label={field.type === "info" ? t("textAr") : t("helpAr")}>
          {field.type === "info" ? (
            <Textarea
              dir="rtl"
              lang="ar"
              className={rtl}
              value={field.help_ar ?? ""}
              maxLength={2000}
              onChange={(e) => onChange({ help_ar: e.target.value || undefined })}
            />
          ) : (
            <TextInput
              dir="rtl"
              lang="ar"
              className={rtl}
              value={field.help_ar ?? ""}
              maxLength={2000}
              onChange={(e) => onChange({ help_ar: e.target.value || undefined })}
            />
          )}
        </Field>
        <Field label={t("key")} hint={t("keyHint")} error={keyError}>
          <TextInput
            dir="ltr"
            value={keyDraft}
            maxLength={60}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={() => {
              if (keyDraft !== field.key && isValidKey(keyDraft) && !keyTaken) onChange({ key: keyDraft });
            }}
          />
        </Field>

        {isChoice(field.type) && (
          <OptionsEditor
            options={field.options ?? []}
            onChange={(options) => onChange({ options })}
            error={err(/\.options(\[\d+\].*)?$/)}
          />
        )}

        {!display && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-13 font-medium text-ink">{t("required")}</span>
            <Toggle
              aria-label={t("required")}
              checked={!!field.required}
              onCheckedChange={(required) => onChange({ required: required || undefined })}
            />
          </div>
        )}

        {VALIDATION_KEYS[field.type] && (
          <ValidationEditor
            field={field}
            onChange={(validation) => onChange({ validation })}
            error={err(/\.validation/)}
          />
        )}

        {field.type !== "section" && (
          <ShowIfEditor
            schema={schema}
            field={field}
            onChange={(showIf) => onChange({ showIf })}
            error={err(/\.showIf/)}
          />
        )}

        {!display && field.type !== "file" && field.type !== "consent" && (
          <MappingSelect
            schema={schema}
            field={field}
            onChange={(maps_to) => onChange({ maps_to })}
            error={err(/\.maps_to$/)}
          />
        )}
      </CardBody>
    </Card>
  );
}

function OptionsEditor({
  options,
  onChange,
  error,
}: {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
  error?: string;
}) {
  const t = useTranslations("academic.builder");
  const set = (i: number, patch: Partial<FieldOption>) =>
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= options.length) return;
    const next = [...options];
    const [o] = next.splice(from, 1);
    next.splice(to, 0, o);
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-13 font-medium text-ink">{t("options")}</legend>
      {options.map((o, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 rounded-md border border-border p-2"
          data-testid="option-row"
        >
          <div className="grid grid-cols-2 gap-1.5">
            <TextInput
              aria-label={t("optionEn", { n: i + 1 })}
              className="h-8 text-13"
              value={o.label_en}
              onChange={(e) => set(i, { label_en: e.target.value })}
              placeholder={t("optionEn", { n: i + 1 })}
            />
            <TextInput
              aria-label={t("optionAr", { n: i + 1 })}
              dir="rtl"
              lang="ar"
              className={cn("h-8 text-13", rtl)}
              value={o.label_ar}
              onChange={(e) => set(i, { label_ar: e.target.value })}
              placeholder={t("optionAr", { n: i + 1 })}
            />
          </div>
          <div className="flex items-center gap-1">
            <TextInput
              aria-label={t("optionValue", { n: i + 1 })}
              dir="ltr"
              className="h-7 flex-1 text-12"
              value={o.value}
              maxLength={60}
              onChange={(e) => set(i, { value: e.target.value })}
            />
            <IconButton
              label={t("moveUp")}
              size="sm"
              className="size-7"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              <ArrowUp />
            </IconButton>
            <IconButton
              label={t("moveDown")}
              size="sm"
              className="size-7"
              disabled={i === options.length - 1}
              onClick={() => move(i, i + 1)}
            >
              <ArrowDown />
            </IconButton>
            <IconButton
              label={t("removeOption")}
              size="sm"
              className="size-7"
              disabled={options.length <= 1}
              onClick={() => onChange(options.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </IconButton>
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        icon={<Plus />}
        className="self-start text-brand"
        onClick={() => {
          let n = options.length + 1;
          while (options.some((o) => o.value === `option_${n}`)) n += 1;
          onChange([...options, { value: `option_${n}`, label_en: "", label_ar: "" }]);
        }}
      >
        {t("addOption")}
      </Button>
      {error && (
        <p className="text-12 text-red" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ValidationEditor({
  field,
  onChange,
  error,
}: {
  field: FormField;
  onChange: (v: FieldValidation | undefined) => void;
  error?: string;
}) {
  const t = useTranslations("academic.builder.validation");
  const v = field.validation ?? {};
  const keys = VALIDATION_KEYS[field.type] ?? [];
  const set = (patch: Partial<FieldValidation>) => {
    const next: FieldValidation = { ...v, ...patch };
    for (const k of Object.keys(next) as (keyof FieldValidation)[]) {
      const val = next[k];
      if (
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0) ||
        val === false
      )
        delete next[k];
    }
    onChange(Object.keys(next).length ? next : undefined);
  };
  const num = (k: keyof FieldValidation, suffix?: ReactNode) => (
    <Field key={k} label={t(k)}>
      <NumberInput
        value={(v[k] as number | undefined) ?? null}
        suffix={suffix}
        onValueChange={(n) => set({ [k]: n ?? undefined })}
      />
    </Field>
  );
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg bg-canvas p-3">
      <legend className="sr-only">{t("title")}</legend>
      <div className="text-13 font-medium text-ink">{t("title")}</div>
      <div className="grid grid-cols-2 gap-3">
        {keys
          .filter((k) => !["pattern", "integer", "types"].includes(k))
          .map((k) => num(k, k === "maxSizeMb" ? "MB" : k.endsWith("OffsetDays") ? t("days") : undefined))}
      </div>
      {keys.includes("pattern") && (
        <Field label={t("pattern")} hint={t("patternHint")}>
          <TextInput
            dir="ltr"
            value={v.pattern ?? ""}
            maxLength={200}
            onChange={(e) => set({ pattern: e.target.value || undefined })}
          />
        </Field>
      )}
      {keys.includes("integer") && (
        <Checkbox
          label={t("integer")}
          checked={!!v.integer}
          onCheckedChange={(integer) => set({ integer })}
        />
      )}
      {keys.includes("types") && (
        <Field label={t("types")}>
          <MultiSelect
            value={v.types ?? [...FILE_TYPES]}
            onValueChange={(types) => set({ types: types as FileExt[] })}
            options={FILE_TYPES.map((x) => ({ value: x, label: x.toUpperCase() }))}
          />
        </Field>
      )}
      {error && (
        <p className="text-12 text-red" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ShowIfEditor({
  schema,
  field,
  onChange,
  error,
}: {
  schema: FormSchema;
  field: FormField;
  onChange: (showIf: FormField["showIf"]) => void;
  error?: string;
}) {
  const t = useTranslations("academic.builder.showIf");
  const locale = useLocale();
  const targets = showIfTargets(schema, field.key);
  const on = !!field.showIf;
  const target = targets.find((f) => f.key === field.showIf?.field);
  const operators = showIfOperators(target);
  const op = showIfOperator(field.showIf);

  const setOperator = (next: ShowIfOperator) => {
    if (!target) return;
    const first = target.options?.[0]?.value;
    if (next === "notEmpty") onChange({ field: target.key, notEmpty: true });
    else if (next === "in") onChange({ field: target.key, in: first ? [first] : [] });
    else onChange({ field: target.key, equals: target.type === "consent" ? true : (first ?? "") });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="leading-tight">
          <span className="block text-13 font-medium text-ink">{t("title")}</span>
          <span className="block text-12 text-muted">{targets.length ? t("hint") : t("noTargets")}</span>
        </span>
        <Toggle
          aria-label={t("title")}
          checked={on}
          disabled={!targets.length}
          onCheckedChange={(next) => {
            if (!next) return onChange(undefined);
            const first = targets.at(-1)!;
            onChange(
              first.options?.length
                ? { field: first.key, equals: first.options[0].value }
                : { field: first.key, notEmpty: true },
            );
          }}
        />
      </div>
      {on && (
        <div className="flex flex-col gap-2 rounded-lg bg-canvas p-3">
          <Field label={t("field")}>
            <Select
              value={field.showIf?.field ?? ""}
              onChange={(e) => {
                const next = targets.find((f) => f.key === e.target.value);
                if (!next) return;
                onChange(
                  next.options?.length
                    ? { field: next.key, equals: next.options[0].value }
                    : { field: next.key, notEmpty: true },
                );
              }}
              options={targets.map((f) => ({ value: f.key, label: fieldLabel(f, locale) || f.key }))}
            />
          </Field>
          <Field label={t("operator")}>
            <Select
              value={op ?? ""}
              onChange={(e) => setOperator(e.target.value as ShowIfOperator)}
              options={operators.map((o) => ({ value: o, label: t(`operators.${o}`) }))}
            />
          </Field>
          {op === "equals" && target && (
            <Field label={t("value")}>
              {target.options?.length ? (
                <Select
                  value={String(field.showIf?.equals ?? "")}
                  onChange={(e) => onChange({ field: target.key, equals: e.target.value })}
                  options={target.options.map((o) => ({
                    value: o.value,
                    label: fieldLabel(o, locale) || o.value,
                  }))}
                />
              ) : target.type === "consent" ? (
                <Select
                  value={String(field.showIf?.equals ?? true)}
                  onChange={(e) => onChange({ field: target.key, equals: e.target.value === "true" })}
                  options={[
                    { value: "true", label: t("checked") },
                    { value: "false", label: t("unchecked") },
                  ]}
                />
              ) : (
                <TextInput
                  value={String(field.showIf?.equals ?? "")}
                  onChange={(e) =>
                    onChange({
                      field: target.key,
                      equals:
                        target.type === "number" || target.type === "wilaya"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </Field>
          )}
          {op === "in" && target?.options && (
            <Field label={t("values")}>
              <MultiSelect
                value={field.showIf?.in ?? []}
                onValueChange={(values) => onChange({ field: target.key, in: values })}
                options={target.options.map((o) => ({
                  value: o.value,
                  label: fieldLabel(o, locale) || o.value,
                }))}
              />
            </Field>
          )}
          {error && (
            <p className="text-12 text-red" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MappingSelect({
  schema,
  field,
  onChange,
  error,
}: {
  schema: FormSchema;
  field: FormField;
  onChange: (maps: FormField["maps_to"]) => void;
  error?: string;
}) {
  const t = useTranslations("academic.builder.mapping");
  const options = mappingOptions(schema, field);
  return (
    <Field label={t("title")} hint={t("hint")} error={error}>
      <Select
        value={field.maps_to ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as FormField["maps_to"])}
        placeholder={t("none")}
        options={options.map((o) => ({
          value: o.value,
          disabled: o.disabled,
          label: `${t(`targets.${o.value}`)}${o.usedBy ? ` · ${t("usedBy", { key: o.usedBy })}` : !o.compatible ? ` · ${t("incompatible")}` : ""}`,
        }))}
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ form settings */

export function FormSettingsCard({ form, onSaved }: { form: FormDetail; onSaved: (f: FormDetail) => void }) {
  const t = useTranslations("academic.builder.settings");
  const initial = (): UpdateFormBody => ({
    nameEn: form.nameEn,
    nameAr: form.nameAr,
    slug: form.slug,
    descriptionEn: form.descriptionEn,
    descriptionAr: form.descriptionAr,
    isDefault: form.isDefault,
    requiresAuth: form.requiresAuth,
    maxSubmissionsPerEmailPerMonth: form.maxSubmissionsPerEmailPerMonth,
    confirmationEn: form.confirmationEn,
    confirmationAr: form.confirmationAr,
  });
  const [values, setValues] = useState<UpdateFormBody>(initial);
  const [baseline, setBaseline] = useState(form.updatedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial());
  if (!dirty && baseline !== form.updatedAt) setBaseline(form.updatedAt);
  const set = (patch: UpdateFormBody) => setValues((v) => ({ ...v, ...patch }));

  async function save() {
    setPending(true);
    setErrors({});
    try {
      const next = await updateForm(form.id, { ...values, updatedAt: baseline });
      onSaved(next);
      setValues({
        nameEn: next.nameEn,
        nameAr: next.nameAr,
        slug: next.slug,
        descriptionEn: next.descriptionEn,
        descriptionAr: next.descriptionAr,
        isDefault: next.isDefault,
        requiresAuth: next.requiresAuth,
        maxSubmissionsPerEmailPerMonth: next.maxSubmissionsPerEmailPerMonth,
        confirmationEn: next.confirmationEn,
        confirmationAr: next.confirmationAr,
      });
      setBaseline(next.updatedAt);
      toast.success(t("saved"));
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "SLUG_TAKEN") setErrors({ slug: t("slugTaken") });
        else if (e.code === "FORM_DEFAULT_REQUIRED") setErrors({ isDefault: t("defaultRequired") });
        else if (e.code === "STALE_UPDATE") setErrors({ form: t("stale") });
        else if (e.fieldErrors.length)
          setErrors(Object.fromEntries(e.fieldErrors.map((d) => [d.field, d.message])));
        else setErrors({ form: e.message });
      } else setErrors({ form: String(e) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card id="form-settings">
      <CardHeader title={t("title")} />
      <CardBody className="flex flex-col gap-3.5">
        {errors.form && <Banner tone="red" title={errors.form} />}
        <Field label={t("nameEn")} required error={errors.nameEn}>
          <TextInput
            value={values.nameEn ?? ""}
            maxLength={160}
            onChange={(e) => set({ nameEn: e.target.value })}
          />
        </Field>
        <Field label={t("nameAr")} required error={errors.nameAr}>
          <TextInput
            dir="rtl"
            lang="ar"
            className={rtl}
            value={values.nameAr ?? ""}
            maxLength={160}
            onChange={(e) => set({ nameAr: e.target.value })}
          />
        </Field>
        <Field label={t("slug")} hint={`/f/${values.slug ?? ""}`} error={errors.slug}>
          <TextInput
            dir="ltr"
            value={values.slug ?? ""}
            maxLength={80}
            onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
          />
        </Field>
        <Field label={t("descriptionEn")}>
          <Textarea
            rows={2}
            value={values.descriptionEn ?? ""}
            onChange={(e) => set({ descriptionEn: e.target.value || null })}
          />
        </Field>
        <Field label={t("descriptionAr")}>
          <Textarea
            rows={2}
            dir="rtl"
            lang="ar"
            className={rtl}
            value={values.descriptionAr ?? ""}
            onChange={(e) => set({ descriptionAr: e.target.value || null })}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-13 text-ink">{t("default")}</span>
          <Toggle
            aria-label={t("default")}
            checked={!!values.isDefault}
            onCheckedChange={(isDefault) => set({ isDefault })}
          />
        </div>
        {errors.isDefault && <p className="text-12 text-red">{errors.isDefault}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="leading-tight">
            <span className="block text-13 text-ink">{t("requiresAuth")}</span>
            <span className="block text-12 text-muted">{t("requiresAuthHint")}</span>
          </span>
          <Toggle
            aria-label={t("requiresAuth")}
            checked={!!values.requiresAuth}
            onCheckedChange={(requiresAuth) => set({ requiresAuth })}
          />
        </div>
        <Field label={t("limit")} hint={t("limitHint")} error={errors.maxSubmissionsPerEmailPerMonth}>
          <NumberInput
            value={values.maxSubmissionsPerEmailPerMonth ?? null}
            onValueChange={(n) => set({ maxSubmissionsPerEmailPerMonth: n === null ? null : Math.round(n) })}
          />
        </Field>
        <Field label={t("confirmationEn")} required error={errors.confirmationEn}>
          <Textarea
            rows={2}
            value={values.confirmationEn ?? ""}
            onChange={(e) => set({ confirmationEn: e.target.value })}
          />
        </Field>
        <Field label={t("confirmationAr")} required error={errors.confirmationAr}>
          <Textarea
            rows={2}
            dir="rtl"
            lang="ar"
            className={rtl}
            value={values.confirmationAr ?? ""}
            onChange={(e) => set({ confirmationAr: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!dirty || pending}
            onClick={() => setValues(initial())}
          >
            {t("discard")}
          </Button>
          <Button size="sm" disabled={!dirty} loading={pending} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function VersionsCard({ form, onView }: { form: FormDetail; onView: (versionId: string) => void }) {
  const t = useTranslations("academic.builder.versions");
  const locale = useLocale();
  return (
    <Card>
      <CardHeader title={t("title")} />
      {form.versions.length === 0 ? (
        <p className="px-[18px] py-3 text-13 text-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {form.versions.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-[18px] py-2.5">
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-13 font-medium text-ink">
                  v{v.version}
                  {form.liveVersion?.id === v.id && (
                    <span className="ms-2 text-12 font-medium text-green">{t("live")}</span>
                  )}
                </span>
                <span className="block text-12 text-muted">
                  {[
                    formatDate(v.publishedAt, locale),
                    v.publishedBy?.fullName,
                    t("submissions", { count: v.submissionsCount }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <IconButton label={t("view", { version: v.version })} size="sm" onClick={() => onView(v.id)}>
                <Eye />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
