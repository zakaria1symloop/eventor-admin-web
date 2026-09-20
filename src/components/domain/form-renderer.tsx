"use client";

import { FileText, Loader2, Paperclip, RotateCcw, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { Checkbox, Field, RadioCards, Select, TextInput, Textarea } from "@/components/forms/fields";
import { DateInput, EmailInput, NumberInput, TimeSelect } from "@/components/forms/inputs";
import { MultiSelect } from "@/components/forms/select-inputs";
import { Button, IconButton } from "@/components/ui/button";
import {
  FILE_MIME,
  FILE_TYPES,
  fieldHelp,
  fieldLabel,
  formSteps,
  isDisplay,
  type FileExt,
  type FormField,
  type FormSchema,
} from "@/lib/forms/schema";
import { WILAYAS } from "@/lib/forms/wilayas";
import {
  addDays,
  validateAnswers,
  validateField,
  visibleKeys,
  type AnswerFile,
  type Answers,
} from "@/lib/forms/validate";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "./file-viewer";

export interface UploadItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: "uploading" | "done" | "failed";
  progress?: number;
  uploadToken?: string;
  /** Kept from the request being edited (no new upload needed). */
  existing?: boolean;
}

export type FormFiles = Record<string, UploadItem[]>;

export interface FormRendererProps {
  schema: FormSchema;
  answers: Answers;
  onAnswersChange: (answers: Answers) => void;
  files: FormFiles;
  onFilesChange: (files: FormFiles | ((current: FormFiles) => FormFiles)) => void;
  /** Uploads one file (public endpoint); omitted in the builder preview (files stay local). */
  upload?: (file: File, onProgress: (percent: number) => void) => Promise<{ uploadToken: string }>;
  maxUploadMb?: number;
  categories?: { id: string; nameEn: string; nameAr: string }[];
  /** Wilayas offered by `wilaya` fields (`GET /public/wilayas`); defaults to the static list of 58. */
  wilayas?: readonly { code: number; name: string; nameAr: string }[];
  /** Today (Africa/Algiers) for date offsets. */
  today: string;
  /** Fields to highlight (changes requested). */
  highlight?: string[];
  /** Server errors by field key (422 FORM_ANSWERS_INVALID). */
  serverErrors?: Record<string, string>;
  /** Final step after the sections (email code); rendered with its own submit. */
  finalStep?: { title: ReactNode; content: ReactNode };
  /** Called when the last section is valid and there is no final step (or on the final step's Next). */
  onComplete?: () => void;
  completeLabel?: ReactNode;
  completing?: boolean;
  /** Controlled step (tests); otherwise internal. */
  step?: number;
  onStepChange?: (step: number) => void;
  header?: ReactNode;
}

let uploadSeq = 0;
/** Picked files by upload item id (for retries). */
const pickedFiles = new Map<string, File>();

/** Files of the answers as the validator sees them (uploads in progress or failed are excluded). */
export function answerFiles(files: FormFiles): Record<string, AnswerFile[]> {
  return Object.fromEntries(
    Object.entries(files).map(([k, list]) => [
      k,
      list
        .filter((f) => f.status !== "failed")
        .map((f) => ({ mimeType: f.mimeType, sizeBytes: f.sizeBytes })),
    ]),
  );
}

/**
 * ACR-07 renderer shared by the public page, the edit link and the builder preview:
 * one step per section with a progress bar, every field type, client-side validation mirroring the API
 * (required, min/max, pattern, date offsets, file type / size / count, showIf).
 */
export function FormRenderer(props: FormRendererProps) {
  const { schema, answers, onAnswersChange, files, today, finalStep } = props;
  const t = useTranslations("publicForm");
  const locale = useLocale();
  const steps = useMemo(() => formSteps(schema), [schema]);
  const [innerStep, setInnerStep] = useState(0);
  const step = props.step ?? innerStep;
  const setStep = (s: number) => {
    setInnerStep(s);
    props.onStepChange?.(s);
    if (typeof window !== "undefined") window.scrollTo?.({ top: 0 });
  };
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const totalSteps = steps.length + (finalStep ? 1 : 0);
  const onFinal = !!finalStep && step >= steps.length;
  const current = steps[Math.min(step, steps.length - 1)];
  const shown = visibleKeys(schema, answers);

  const uploading = Object.values(files).some((l) => l.some((f) => f.status === "uploading"));
  const fileCtx = answerFiles(files);

  const errorFor = (field: FormField): string | null => {
    const code = validateField(field, answers[field.key], {
      today,
      files: fileCtx[field.key],
      maxUploadMb: props.maxUploadMb,
    });
    return code ?? props.serverErrors?.[field.key] ?? null;
  };

  function next() {
    if (!current) return props.onComplete?.();
    const keys = current.fields.map((f) => f.key);
    const issues = validateAnswers(schema, answers, {
      today,
      files: fileCtx,
      maxUploadMb: props.maxUploadMb,
      keys,
    });
    setAttempted(new Set([...attempted, step]));
    if (issues.length > 0 || uploading) {
      const first = issues[0]?.fieldKey;
      if (first && typeof document !== "undefined") document.getElementById(`field-${first}`)?.focus?.();
      return;
    }
    if (step < steps.length - 1 || finalStep) setStep(step + 1);
    else props.onComplete?.();
  }

  const message = (field: FormField, code: string) => {
    const v = field.validation ?? {};
    const params = {
      min: v.min ?? v.minLength ?? v.minSelected ?? 0,
      max: v.max ?? v.maxLength ?? v.maxSelected ?? v.maxFiles ?? 0,
      date:
        code === "DATE_TOO_EARLY" && v.minOffsetDays !== undefined
          ? addDays(today, v.minOffsetDays)
          : code === "DATE_TOO_LATE" && v.maxOffsetDays !== undefined
            ? addDays(today, v.maxOffsetDays)
            : "",
      files: v.maxFiles ?? 1,
      size: Math.min(v.maxSizeMb ?? props.maxUploadMb ?? 5, props.maxUploadMb ?? 5),
    };
    return t.has(`errors.${code}`) ? t(`errors.${code}`, params) : t("errors.INVALID");
  };

  return (
    <div className="flex flex-col gap-5">
      {props.header}
      {totalSteps > 1 && (
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={Math.min(step + 1, totalSteps)}
          aria-label={t("progress", { step: Math.min(step + 1, totalSteps), total: totalSteps })}
        >
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-pill", i <= step ? "bg-brand" : "bg-gray-soft")}
            />
          ))}
        </div>
      )}
      {onFinal ? (
        <>
          <h2 className="text-18 font-semibold text-ink">{finalStep!.title}</h2>
          {finalStep!.content}
        </>
      ) : current ? (
        <>
          {current.section && (
            <div>
              <h2 className="text-18 font-semibold text-ink">{fieldLabel(current.section, locale)}</h2>
              {fieldHelp(current.section, locale) && (
                <p className="mt-1 text-13 text-muted">{fieldHelp(current.section, locale)}</p>
              )}
            </div>
          )}
          {current.fields
            .filter((f) => shown.has(f.key))
            .map((f) => {
              const code = errorFor(f);
              const showError =
                code && (attempted.has(step) || touched.has(f.key) || !!props.serverErrors?.[f.key]);
              return (
                <FieldControl
                  key={f.key}
                  field={f}
                  value={answers[f.key]}
                  onChange={(value) => onAnswersChange({ ...answers, [f.key]: value })}
                  onBlur={() => setTouched((s) => new Set(s).add(f.key))}
                  error={showError ? message(f, code) : undefined}
                  highlight={props.highlight?.includes(f.key)}
                  files={files[f.key] ?? []}
                  onFilesChange={(list) =>
                    props.onFilesChange((cur) => ({ ...cur, [f.key]: list(cur[f.key] ?? []) }))
                  }
                  upload={props.upload}
                  maxUploadMb={props.maxUploadMb}
                  categories={props.categories}
                  wilayas={props.wilayas}
                  today={today}
                />
              );
            })}
        </>
      ) : (
        <p className="text-13 text-muted">{t("emptyForm")}</p>
      )}
      {!onFinal && (
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" size="md" className="h-11 flex-1" onClick={() => setStep(step - 1)}>
              {t("back")}
            </Button>
          )}
          <Button size="md" className="h-11 flex-[2]" loading={props.completing || uploading} onClick={next}>
            {step < steps.length - 1 || finalStep ? t("next") : (props.completeLabel ?? t("submit"))}
          </Button>
        </div>
      )}
      {onFinal && (
        <Button variant="ghost" onClick={() => setStep(steps.length - 1)}>
          {t("back")}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

function FieldControl({
  field: f,
  value,
  onChange,
  onBlur,
  error,
  highlight,
  files,
  onFilesChange,
  upload,
  maxUploadMb,
  categories,
  wilayas = WILAYAS,
  today,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  error?: string;
  highlight?: boolean;
  files: UploadItem[];
  onFilesChange: (update: (current: UploadItem[]) => UploadItem[]) => void;
  upload?: FormRendererProps["upload"];
  maxUploadMb?: number;
  categories?: FormRendererProps["categories"];
  wilayas?: FormRendererProps["wilayas"];
  today: string;
}) {
  const locale = useLocale();
  const t = useTranslations("publicForm");
  const id = `field-${f.key}`;
  const label = fieldLabel(f, locale);
  const help = fieldHelp(f, locale);
  const ar = locale === "ar";
  const v = f.validation ?? {};
  const wrap = (node: ReactNode) => (
    <div
      className={cn(highlight && "-mx-3 rounded-lg border border-amber/40 bg-amber-soft px-3 py-2.5")}
      data-field={f.key}
      data-highlight={highlight || undefined}
    >
      {highlight && <div className="mb-1 text-12 font-medium text-amber">{t("changeRequested")}</div>}
      {node}
    </div>
  );

  if (f.type === "section") return null;
  if (f.type === "info") {
    return wrap(
      <div className="rounded-lg bg-canvas px-4 py-3">
        {label && <div className="text-14 font-medium text-ink">{label}</div>}
        {help && <p className="mt-0.5 text-13 whitespace-pre-line text-ink-2">{help}</p>}
      </div>,
    );
  }
  if (f.type === "consent") {
    return wrap(
      <div className="flex flex-col gap-1">
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(on) => {
            onChange(on);
            onBlur();
          }}
          label={
            <>
              {label}
              {f.required && <span className="ms-1 text-red">*</span>}
            </>
          }
          description={help}
        />
        {error && (
          <p className="text-12 text-red" role="alert">
            {error}
          </p>
        )}
      </div>,
    );
  }

  const optionLabel = (o: { label_en: string; label_ar: string }) => fieldLabel(o, locale);
  let control: ReactNode;
  switch (f.type) {
    case "short_text":
      control = (
        <TextInput
          id={id}
          className="h-11"
          value={(value as string) ?? ""}
          maxLength={v.maxLength ?? 190}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          dir="auto"
        />
      );
      break;
    case "long_text":
      control = (
        <Textarea
          id={id}
          rows={4}
          value={(value as string) ?? ""}
          maxLength={v.maxLength ?? 5000}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          dir="auto"
        />
      );
      break;
    case "number":
      control = (
        <NumberInput
          id={id}
          className="h-11"
          value={typeof value === "number" ? value : null}
          onValueChange={(n) => onChange(n)}
          onBlur={onBlur}
        />
      );
      break;
    case "email":
      control = (
        <EmailInput
          id={id}
          className="h-11"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
      break;
    case "phone":
      control = (
        <TextInput
          id={id}
          className="h-11"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="0550 12 34 56"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
      break;
    case "dropdown":
      control = (
        <Select
          id={id}
          className="h-11"
          value={(value as string) ?? ""}
          placeholder={t("select")}
          onChange={(e) => {
            onChange(e.target.value);
            onBlur();
          }}
          options={(f.options ?? []).map((o) => ({ value: o.value, label: optionLabel(o) }))}
        />
      );
      break;
    case "single_choice":
      control = (
        <RadioCards
          aria-label={label}
          value={(value as string) ?? ""}
          onValueChange={(val) => {
            onChange(val);
            onBlur();
          }}
          options={(f.options ?? []).map((o) => ({ value: o.value, label: optionLabel(o) }))}
        />
      );
      break;
    case "multi_choice": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div
          role="group"
          aria-label={label}
          className="flex flex-col gap-2.5 rounded-md border border-border px-3 py-3"
        >
          {(f.options ?? []).map((o) => (
            <Checkbox
              key={o.value}
              checked={list.includes(o.value)}
              label={optionLabel(o)}
              onCheckedChange={(on) => {
                onChange(on ? [...list, o.value] : list.filter((x) => x !== o.value));
                onBlur();
              }}
            />
          ))}
        </div>
      );
      break;
    }
    case "date": {
      const min = v.minOffsetDays !== undefined ? addDays(today, v.minOffsetDays) : undefined;
      const max = v.maxOffsetDays !== undefined ? addDays(today, v.maxOffsetDays) : undefined;
      control = (
        <DateInput
          id={id}
          className="h-11"
          value={(value as string) ?? ""}
          min={min}
          max={max}
          onValueChange={(d) => onChange(d)}
          onBlur={onBlur}
        />
      );
      break;
    }
    case "time_range": {
      const tr = (value as { start?: string; end?: string }) ?? {};
      control = (
        <div className="grid grid-cols-2 gap-2" dir="ltr">
          <TimeSelect
            id={id}
            aria-label={t("start")}
            value={tr.start ?? ""}
            onValueChange={(start) => {
              onChange({ ...tr, start });
              onBlur();
            }}
            placeholder={t("start")}
          />
          <TimeSelect
            aria-label={t("end")}
            value={tr.end ?? ""}
            onValueChange={(end) => {
              onChange({ ...tr, end });
              onBlur();
            }}
            placeholder={t("end")}
          />
        </div>
      );
      break;
    }
    case "wilaya":
      control = (
        <Select
          id={id}
          className="h-11"
          value={typeof value === "number" ? String(value) : ""}
          placeholder={t("select")}
          onChange={(e) => {
            onChange(e.target.value ? Number(e.target.value) : null);
            onBlur();
          }}
          options={wilayas.map((w) => ({
            value: String(w.code),
            label: `${w.code} · ${ar ? w.nameAr : w.name}`,
          }))}
        />
      );
      break;
    case "service_categories": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      control = categories?.length ? (
        <MultiSelect
          id={id}
          value={list}
          onValueChange={(val) => {
            onChange(val);
            onBlur();
          }}
          options={categories.map((c) => ({ value: c.id, label: ar ? c.nameAr || c.nameEn : c.nameEn }))}
          placeholder={t("select")}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-13 text-muted">
          {t("categoriesUnavailable")}
        </p>
      );
      break;
    }
    case "budget_range": {
      const b = (value as { min?: number | null; max?: number | null }) ?? {};
      control = (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            id={id}
            className="h-11"
            aria-label={t("budgetMin")}
            placeholder={t("budgetMin")}
            suffix={ar ? "دج" : "DA"}
            value={b.min ?? null}
            onValueChange={(min) => onChange({ ...b, min })}
            onBlur={onBlur}
          />
          <NumberInput
            className="h-11"
            aria-label={t("budgetMax")}
            placeholder={t("budgetMax")}
            suffix={ar ? "دج" : "DA"}
            value={b.max ?? null}
            onValueChange={(max) => onChange({ ...b, max })}
            onBlur={onBlur}
          />
        </div>
      );
      break;
    }
    case "file":
      control = (
        <FileField
          id={id}
          field={f}
          files={files}
          onFilesChange={onFilesChange}
          upload={upload}
          maxUploadMb={maxUploadMb}
          onBlur={onBlur}
        />
      );
      break;
    default:
      control = null;
  }

  return wrap(
    <Field label={label} required={f.required && !isDisplay(f.type)} hint={help} error={error}>
      {control as React.ReactElement<Record<string, unknown>>}
    </Field>,
  );
}

function FileField({
  id,
  field,
  files,
  onFilesChange,
  upload,
  maxUploadMb,
  onBlur,
}: {
  id: string;
  field: FormField;
  files: UploadItem[];
  onFilesChange: (update: (current: UploadItem[]) => UploadItem[]) => void;
  upload?: FormRendererProps["upload"];
  maxUploadMb?: number;
  onBlur: () => void;
}) {
  const t = useTranslations("publicForm");
  const locale = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const v = field.validation ?? {};
  const types = (v.types ?? [...FILE_TYPES]) as FileExt[];
  const maxFiles = v.maxFiles ?? 1;
  const maxMb = Math.min(v.maxSizeMb ?? maxUploadMb ?? 5, maxUploadMb ?? Infinity);
  const [problem, setProblem] = useState<string | null>(null);

  function start(item: UploadItem, file: File) {
    if (!upload) return;
    const patch = (p: Partial<UploadItem>) =>
      onFilesChange((cur) => cur.map((x) => (x.id === item.id ? { ...x, ...p } : x)));
    upload(file, (progress) => patch({ progress })).then(
      (res) => patch({ status: "done", uploadToken: res.uploadToken, progress: 100 }),
      () => patch({ status: "failed" }),
    );
  }

  function add(list: File[]) {
    const accepted: File[] = [];
    let err: string | null = null;
    const mimes = types.map((x) => FILE_MIME[x]);
    for (const file of list) {
      if (!mimes.includes(file.type)) err = t("errors.FILE_TYPE_NOT_ALLOWED");
      else if (file.size > maxMb * 1024 * 1024) err = t("errors.FILE_TOO_LARGE", { size: maxMb });
      else accepted.push(file);
    }
    const room = maxFiles - files.length;
    if (accepted.length > room) {
      err = t("errors.TOO_MANY_FILES", { files: maxFiles });
      accepted.splice(Math.max(room, 0));
    }
    setProblem(err);
    const items = accepted.map((file) => {
      const item: UploadItem = {
        id: `upload-${++uploadSeq}`,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: upload ? "uploading" : "done",
        progress: 0,
      };
      pickedFiles.set(item.id, file);
      return item;
    });
    onFilesChange((cur) => [...cur, ...items]);
    items.forEach((item) => start(item, pickedFiles.get(item.id)!));
    onBlur();
  }

  return (
    <div className="flex flex-col gap-2" id={id} tabIndex={-1}>
      {files.map((f) => (
        <div
          key={f.id}
          className={cn(
            "flex items-center gap-2.5 rounded-md border px-3 py-2",
            f.status === "failed" ? "border-red/40 bg-red-soft" : "border-border",
          )}
        >
          <FileText className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-13 text-ink">{f.name}</span>
            <span className="block text-12 text-muted">
              {f.status === "uploading"
                ? t("uploading", { progress: f.progress ?? 0 })
                : f.status === "failed"
                  ? t("uploadFailed")
                  : formatBytes(f.sizeBytes, locale)}
            </span>
            {f.status === "uploading" && (
              <span
                role="progressbar"
                aria-valuenow={f.progress ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1 block h-1 overflow-hidden rounded-pill bg-gray-soft"
              >
                <span className="block h-full bg-brand" style={{ width: `${f.progress ?? 0}%` }} />
              </span>
            )}
          </span>
          {f.status === "uploading" && <Loader2 className="size-4 animate-spin text-brand" aria-hidden />}
          {f.status === "failed" && pickedFiles.get(f.id) && (
            <IconButton
              label={t("retry")}
              size="sm"
              onClick={() => {
                onFilesChange((cur) =>
                  cur.map((x) => (x.id === f.id ? { ...x, status: "uploading", progress: 0 } : x)),
                );
                start(f, pickedFiles.get(f.id)!);
              }}
            >
              <RotateCcw />
            </IconButton>
          )}
          <IconButton
            label={t("removeFile", { name: f.name })}
            size="sm"
            onClick={() => onFilesChange((cur) => cur.filter((x) => x.id !== f.id))}
          >
            <X />
          </IconButton>
        </div>
      ))}
      {files.length < maxFiles && (
        <button
          type="button"
          aria-describedby={hintId}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(Array.from(e.dataTransfer.files));
          }}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-brand/50 px-4 py-4 text-13 font-medium text-brand hover:bg-brand-soft"
        >
          <Paperclip className="size-5" aria-hidden />
          {t("attach", { types: types.map((x) => x.toUpperCase()).join(", "), size: maxMb })}
        </button>
      )}
      <p id={hintId} className="sr-only">
        {t("fileHint", { files: maxFiles, size: maxMb })}
      </p>
      <input
        ref={input}
        type="file"
        hidden
        multiple={maxFiles > 1}
        data-testid={`file-${field.key}`}
        accept={types.map((x) => FILE_MIME[x]).join(",")}
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {problem && <Banner tone="red" title={problem} />}
    </div>
  );
}
