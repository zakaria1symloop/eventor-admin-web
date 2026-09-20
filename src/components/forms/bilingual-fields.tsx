"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Count } from "@/components/ui/badge";
import { Field, TextInput, Textarea } from "./fields";

export type BilingualLang = "en" | "ar";

export interface BilingualFieldConfig {
  /** Base name; values are stored as `${name}_en` / `${name}_ar` (API DTO naming). */
  name: string;
  label: ReactNode;
  multiline?: boolean;
  required?: boolean;
  placeholder?: { en?: string; ar?: string };
  maxLength?: number;
}

export type BilingualValues = Record<string, string>;

export function bilingualKey(name: string, lang: BilingualLang) {
  return `${name}_${lang}`;
}

/** Required fields left empty in a language (shown as the tab's "missing" count). */
export function countMissing(fields: BilingualFieldConfig[], values: BilingualValues, lang: BilingualLang) {
  return fields.filter((f) => (f.required ?? true) && !(values[bilingualKey(f.name, lang)] ?? "").trim())
    .length;
}

export interface BilingualFieldsProps {
  fields: BilingualFieldConfig[];
  values: BilingualValues;
  onChange: (key: string, value: string) => void;
  /** Errors keyed like values (`title_ar`), e.g. from ApiError details. */
  errors?: Record<string, ReactNode | undefined>;
  defaultLang?: BilingualLang;
  disabled?: boolean;
}

/** EN / العربية tabs with a missing count; Arabic inputs are dir="rtl" and use Cairo. */
export function BilingualFields({
  fields,
  values,
  onChange,
  errors = {},
  defaultLang = "en",
  disabled,
}: BilingualFieldsProps) {
  const t = useTranslations("forms");
  const [lang, setLang] = useState<BilingualLang>(defaultLang);
  const langs: { key: BilingualLang; label: string }[] = [
    { key: "en", label: "English" },
    { key: "ar", label: "العربية" },
  ];

  return (
    <RadixTabs.Root value={lang} onValueChange={(v) => setLang(v as BilingualLang)}>
      <RadixTabs.List
        aria-label={t("languages")}
        className="mb-4 flex items-end gap-5 border-b border-border"
      >
        {langs.map((l) => {
          const missing = countMissing(fields, values, l.key);
          const hasError = fields.some((f) => errors[bilingualKey(f.name, l.key)]);
          return (
            <RadixTabs.Trigger
              key={l.key}
              value={l.key}
              lang={l.key}
              className={cn(
                "-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent text-14 text-ink-2 hover:text-ink",
                "data-[state=active]:border-brand data-[state=active]:font-medium data-[state=active]:text-brand",
              )}
            >
              {l.label}
              {missing > 0 ? (
                <Count tone={hasError ? "red" : "amber"}>
                  <span aria-hidden>{missing}</span>
                  <span className="sr-only">{t("missingCount", { count: missing })}</span>
                </Count>
              ) : null}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
      {langs.map((l) => (
        <RadixTabs.Content
          key={l.key}
          value={l.key}
          forceMount
          hidden={lang !== l.key}
          className="flex flex-col gap-4"
        >
          {fields.map((f) => {
            const key = bilingualKey(f.name, l.key);
            const ar = l.key === "ar";
            const common = {
              name: key,
              value: values[key] ?? "",
              disabled,
              maxLength: f.maxLength,
              placeholder: f.placeholder?.[l.key],
              dir: ar ? ("rtl" as const) : ("ltr" as const),
              lang: l.key,
              className: cn(ar && "font-arabic text-start"),
            };
            return (
              <Field key={key} label={f.label} required={f.required ?? true} error={errors[key]}>
                {f.multiline ? (
                  <Textarea {...common} rows={4} onChange={(e) => onChange(key, e.target.value)} />
                ) : (
                  <TextInput {...common} onChange={(e) => onChange(key, e.target.value)} />
                )}
              </Field>
            );
          })}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
