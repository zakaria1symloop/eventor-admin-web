"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, FileX2, Lock, MailCheck, SearchX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FormRenderer, type FormFiles, type UploadItem } from "@/components/domain/form-renderer";
import { Banner } from "@/components/feedback/banner";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Field, TextInput } from "@/components/forms/fields";
import { EmailInput } from "@/components/forms/inputs";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import {
  editRequestAnswers,
  formKeys,
  getEditableRequest,
  getPublicCategories,
  getPublicForm,
  getPublicWilayas,
  sendFormCode,
  submitForm,
  uploadFormFile,
  type SubmissionResult,
} from "@/lib/api/forms";
import { FILE_MIME, fieldLabel, formSteps, toSchema, type FormSchema } from "@/lib/forms/schema";
import { algiersToday, cleanAnswers, type Answers } from "@/lib/forms/validate";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mobile-first page frame (opened inside the app WebView). No AppShell, no auth. */
export function PublicFrame({
  title,
  children,
  back,
}: {
  title?: ReactNode;
  children: ReactNode;
  back?: () => void;
}) {
  return (
    <div className="min-h-dvh bg-canvas sm:px-4 sm:py-8">
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface sm:min-h-0 sm:rounded-2xl sm:border sm:border-border">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          {back && (
            <button
              type="button"
              onClick={back}
              className="-ms-1 rounded-md p-1 text-ink hover:bg-gray-soft"
              aria-label="Back"
            >
              <ChevronLeft className="flip-rtl size-5" aria-hidden />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate text-18 font-semibold text-ink">{title}</h1>
          <LanguageSwitch className="h-8 [&_button]:h-[26px] [&_button]:min-w-[36px] [&_button]:px-2" />
        </header>
        <div className="flex-1 px-4 py-5">{children}</div>
      </main>
    </div>
  );
}

function storageKey(slug: string, version: number) {
  return `eventor-form:${slug}:v${version}`;
}

function readDraft(key: string): { answers: Answers; email?: string } | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { answers: Answers; email?: string }) : null;
  } catch {
    return null;
  }
}

/** Field key → first step index containing it. */
function stepOf(schema: FormSchema, key: string): number {
  return Math.max(
    0,
    formSteps(schema).findIndex((s) => s.fields.some((f) => f.key === key)),
  );
}

function uploadsOf(files: FormFiles) {
  return Object.entries(files).flatMap(([fieldKey, list]) =>
    list
      .filter((f) => f.status === "done" && f.uploadToken)
      .map((f) => ({ fieldKey, uploadToken: f.uploadToken! })),
  );
}

/* ------------------------------------------------------------------ ACR-07 /f/:slug */

/** Visible categories and open wilayas for `service_categories` / `wilaya` fields (static list while loading or on error). */
function usePublicCatalog() {
  const categories = useQuery({
    queryKey: ["public", "categories"],
    queryFn: getPublicCategories,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const wilayas = useQuery({
    queryKey: ["public", "wilayas"],
    queryFn: getPublicWilayas,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return {
    categories: categories.data,
    wilayas: wilayas.data?.length ? wilayas.data : undefined,
  };
}

export function PublicFormScreen({ slug }: { slug: string }) {
  const t = useTranslations("publicForm");
  const locale = useLocale();
  const catalog = usePublicCatalog();
  const query = useQuery({
    queryKey: formKeys.public(slug),
    queryFn: () => getPublicForm(slug),
    retry: false,
  });
  const form = query.data;
  const schema = useMemo(() => toSchema(form?.schema), [form?.schema]);
  const [today] = useState(() => algiersToday());

  const [answers, setAnswers] = useState<Answers>({});
  const [files, setFiles] = useState<FormFiles>({});
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<SubmissionResult | null>(null);

  // Restore the autosaved draft once the form (and its version) is known.
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!form) return;
    const key = storageKey(slug, form.version);
    if (restored.current === key) return;
    restored.current = key;
    const draft = readDraft(key);
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers(draft.answers ?? {});
      setEmail(draft.email ?? "");
    }
  }, [form, slug]);
  useEffect(() => {
    if (!form || done || restored.current !== storageKey(slug, form.version)) return;
    try {
      window.localStorage.setItem(storageKey(slug, form.version), JSON.stringify({ answers, email }));
    } catch {
      /* storage unavailable */
    }
  }, [answers, email, form, slug, done]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  if (query.isPending) {
    return (
      <PublicFrame title={t("loading")}>
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-gray-soft" />
          ))}
        </div>
      </PublicFrame>
    );
  }
  if (query.isError) {
    const e = query.error;
    const closed = e instanceof ApiError && (e.status === 410 || e.code === "FORM_CLOSED");
    const missing = e instanceof ApiError && (e.status === 404 || e.code === "FORM_NOT_FOUND");
    return (
      <PublicFrame title={t("title")}>
        {closed ? (
          <EmptyState
            icon={<Lock />}
            tone="gray"
            title={t("closedTitle")}
            description={t("closedDescription")}
          />
        ) : missing ? (
          <EmptyState
            icon={<SearchX />}
            tone="gray"
            title={t("notFoundTitle")}
            description={t("notFoundDescription")}
          />
        ) : (
          <ErrorState error={e} onRetry={() => void query.refetch()} />
        )}
      </PublicFrame>
    );
  }

  const f = form!;
  const name = locale === "ar" ? f.nameAr || f.nameEn : f.nameEn;
  const description = locale === "ar" ? f.descriptionAr || f.descriptionEn : f.descriptionEn;

  if (done) {
    return (
      <PublicFrame title={name}>
        <EmptyState
          icon={<CheckCircle2 />}
          tone="green"
          title={t("sentTitle", { reference: done.reference })}
          description={locale === "ar" ? done.confirmationAr || done.confirmationEn : done.confirmationEn}
          actions={[
            <p key="email" className="text-13 text-muted">
              {t("sentEmail", { email: codeSentTo ?? email })}
            </p>,
          ]}
        />
      </PublicFrame>
    );
  }

  async function sendCode() {
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) return setEmailError(t("errors.EMAIL_INVALID"));
    setEmailError(null);
    setSending(true);
    try {
      const res = await sendFormCode(slug, value);
      setCodeSentTo(res.email);
      setResendIn(res.resendAfterSeconds || 60);
      setCode("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "CODE_RESEND_TOO_SOON") {
        const wait = (e.details as { retryAfterSeconds?: number } | null)?.retryAfterSeconds ?? 60;
        setCodeSentTo(value);
        setResendIn(wait);
      } else if (e instanceof ApiError && e.code === "VALIDATION_FAILED")
        setEmailError(t("errors.EMAIL_INVALID"));
      else setEmailError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!codeSentTo) return setCodeError(t("sendCodeFirst"));
    if (!/^\d{6}$/.test(code)) return setCodeError(t("errors.CODE_FORMAT"));
    setCodeError(null);
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await submitForm(slug, {
        email: codeSentTo,
        code,
        answers: cleanAnswers(schema, answers),
        uploads: uploadsOf(files),
      });
      try {
        window.localStorage.removeItem(storageKey(slug, f.version));
      } catch {
        /* ignore */
      }
      setDone(res);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "CODE_INVALID" || e.code === "CODE_EXPIRED") setCodeError(t(`errors.${e.code}`));
        else if (e.code === "FORM_ANSWERS_INVALID" && Array.isArray(e.details)) {
          const map = Object.fromEntries(
            (e.details as { fieldKey: string; code: string }[]).map((d) => [d.fieldKey, d.code]),
          );
          setServerErrors(map);
          const first = (e.details as { fieldKey: string }[])[0]?.fieldKey;
          if (first) setStep(stepOf(schema, first));
          setFormError(t("fixErrors"));
        } else if (
          ["FORM_SUBMISSION_LIMIT", "FORM_REQUIRES_ACCOUNT", "UPLOAD_TOKEN_INVALID", "FORM_CLOSED"].includes(
            e.code,
          )
        ) {
          setFormError(t(`errors.${e.code}`, { max: f.maxSubmissionsPerEmailPerMonth ?? 0 }));
        } else setFormError(e.message);
      } else setFormError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const finalStep = {
    title: t("emailTitle"),
    content: (
      <div className="flex flex-col gap-4">
        <p className="text-13 text-muted">{t("emailDescription")}</p>
        {formError && <Banner tone="red" title={formError} />}
        <Field label={t("email")} required error={emailError ?? undefined}>
          <EmailInput
            className="h-11"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (codeSentTo && e.target.value.trim().toLowerCase() !== codeSentTo) setCodeSentTo(null);
            }}
          />
        </Field>
        <Button
          variant={codeSentTo ? "secondary" : "primary"}
          className="h-11"
          loading={sending}
          disabled={resendIn > 0}
          onClick={() => void sendCode()}
        >
          {codeSentTo ? (resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")) : t("sendCode")}
        </Button>
        {codeSentTo && (
          <>
            <Banner tone="blue" icon={<MailCheck />} title={t("codeSent", { email: codeSentTo })} />
            <Field label={t("code")} required error={codeError ?? undefined}>
              <TextInput
                className="h-11 text-center text-18 tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>
          </>
        )}
        <Button
          className="h-11"
          loading={submitting}
          disabled={!codeSentTo || code.length !== 6}
          onClick={() => void submit()}
        >
          {t("submit")}
        </Button>
        {f.requiresAuth && <p className="text-12 text-muted">{t("requiresAccount")}</p>}
      </div>
    ),
  };

  return (
    <PublicFrame title={name} back={step > 0 ? () => setStep(step - 1) : undefined}>
      <FormRenderer
        schema={schema}
        answers={answers}
        onAnswersChange={(a) => {
          setAnswers(a);
          if (Object.keys(serverErrors).length) setServerErrors({});
        }}
        files={files}
        onFilesChange={setFiles}
        upload={(file, onProgress) => uploadFormFile(slug, file, onProgress, locale)}
        maxUploadMb={f.uploadMaxMb}
        categories={catalog.categories ?? f.categories}
        wilayas={catalog.wilayas}
        today={today}
        serverErrors={serverErrors}
        step={step}
        onStepChange={setStep}
        finalStep={finalStep}
        header={description ? <p className="text-13 text-muted">{description}</p> : undefined}
      />
    </PublicFrame>
  );
}

/* ------------------------------------------------------------------ edit link (changes requested) */

export function EditRequestScreen({ slug, token }: { slug: string; token: string }) {
  const t = useTranslations("publicForm");
  const locale = useLocale();
  const catalog = usePublicCatalog();
  const query = useQuery({
    queryKey: formKeys.editable(slug, token),
    queryFn: () => getEditableRequest(slug, token),
    retry: false,
    enabled: !!token,
  });
  const data = query.data;
  const schema = useMemo(() => toSchema(data?.schema), [data?.schema]);
  const [today] = useState(() => algiersToday());
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [files, setFiles] = useState<FormFiles | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  if (data && answers === null) {
    // Prefill: answers as sent; file fields keep their files unless replaced.
    const initialFiles: FormFiles = {};
    const initial: Answers = {};
    for (const field of schema.fields) {
      const value = data.answers[field.key];
      if (field.type === "file") {
        const ids = Array.isArray(value) ? (value as string[]) : [];
        initialFiles[field.key] = ids.map((id, i): UploadItem => ({
          id: `existing-${id}`,
          name: t("existingFile", { n: i + 1 }),
          mimeType: FILE_MIME[(field.validation?.types?.[0] ?? "pdf") as keyof typeof FILE_MIME],
          sizeBytes: 0,
          status: "done",
          existing: true,
        }));
      } else if (value !== undefined) initial[field.key] = value;
    }
    setAnswers(initial);
    setFiles(initialFiles);
    const first = data.requestedChanges.fields[0];
    if (first) setStep(stepOf(schema, first));
  }

  if (!token || query.isError) {
    const invalid =
      !token ||
      (query.error instanceof ApiError &&
        (query.error.status === 404 || query.error.code === "EDIT_LINK_INVALID"));
    return (
      <PublicFrame title={t("editTitle")}>
        {invalid ? (
          <EmptyState
            icon={<FileX2 />}
            tone="gray"
            title={t("editInvalidTitle")}
            description={t("editInvalidDescription")}
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </PublicFrame>
    );
  }
  if (query.isPending || !data || !answers || !files) {
    return (
      <PublicFrame title={t("loading")}>
        <div className="h-40 animate-pulse rounded-md bg-gray-soft" aria-busy="true" />
      </PublicFrame>
    );
  }
  const name = locale === "ar" ? data.formNameAr || data.formNameEn : data.formNameEn;
  if (done) {
    return (
      <PublicFrame title={name}>
        <EmptyState
          icon={<CheckCircle2 />}
          tone="green"
          title={t("editDoneTitle", { reference: data.reference })}
          description={t("editDoneDescription")}
        />
      </PublicFrame>
    );
  }

  const requested = data.requestedChanges.fields
    .map((k) => schema.fields.find((f) => f.key === k))
    .filter(Boolean)
    .map((f) => fieldLabel(f!, locale));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // File fields untouched keep their current files: only new uploads are sent.
      const newUploads = Object.entries(files!).flatMap(([fieldKey, list]) =>
        list
          .filter((f) => !f.existing && f.status === "done" && f.uploadToken)
          .map((f) => ({ fieldKey, uploadToken: f.uploadToken! })),
      );
      await editRequestAnswers(slug, token, { answers: cleanAnswers(schema, answers!), uploads: newUploads });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "FORM_ANSWERS_INVALID" && Array.isArray(e.details)) {
        const details = e.details as { fieldKey: string; code: string }[];
        setServerErrors(Object.fromEntries(details.map((d) => [d.fieldKey, d.code])));
        if (details[0]) setStep(stepOf(schema, details[0].fieldKey));
        setError(t("fixErrors"));
      } else if (e instanceof ApiError && e.code === "EDIT_LINK_INVALID")
        setError(t("editInvalidDescription"));
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PublicFrame title={name} back={step > 0 ? () => setStep(step - 1) : undefined}>
      <FormRenderer
        schema={schema}
        answers={answers}
        onAnswersChange={(a) => {
          setAnswers(a);
          setServerErrors({});
        }}
        files={files}
        onFilesChange={(next) => setFiles((cur) => (typeof next === "function" ? next(cur ?? {}) : next))}
        upload={(file, onProgress) => uploadFormFile(slug, file, onProgress, locale)}
        categories={catalog.categories}
        wilayas={catalog.wilayas}
        today={today}
        highlight={data.requestedChanges.fields}
        serverErrors={serverErrors}
        step={step}
        onStepChange={setStep}
        completeLabel={t("resubmit")}
        completing={saving}
        onComplete={() => void save()}
        header={
          <div className="flex flex-col gap-3">
            <Banner
              tone="amber"
              title={t("changesRequested", { reference: data.reference })}
              description={
                <>
                  <span className="block whitespace-pre-line">{data.requestedChanges.message}</span>
                  {requested.length > 0 && (
                    <span className="mt-1 block font-medium">
                      {t("fieldsToChange", { fields: requested.join(", ") })}
                    </span>
                  )}
                </>
              }
            />
            {error && <Banner tone="red" title={error} />}
          </div>
        }
      />
    </PublicFrame>
  );
}
