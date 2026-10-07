"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, SearchX, Send, Trash2, UserRound } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { UnsavedChangesGuard, useUnsavedChanges } from "@/components/feedback/unsaved-changes-guard";
import { BilingualFields } from "@/components/forms/bilingual-fields";
import { LineItemsEditor } from "@/components/forms/editors";
import { Checkbox, Field, Select, TextInput, Toggle } from "@/components/forms/fields";
import { DateRangeInput, NumberInput } from "@/components/forms/inputs";
import { WeeklyHoursEditor } from "@/components/forms/weekly-hours";
import { PhotoUploader, type PhotoItem } from "@/components/forms/photo-uploader";
import { AsyncSelect, MultiSelect, type Option } from "@/components/forms/select-inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  createService,
  deletePhoto,
  getService,
  localTitle,
  PRICE_TYPES,
  reorderPhotos,
  serviceAction,
  serviceKeys,
  updateService,
  uploadPhoto,
  type PriceType,
  type ServiceDetail,
} from "@/lib/api/services";
import { getPack } from "@/lib/api/packs";
import { getUser, userKeys } from "@/lib/api/users";
import { cn } from "@/lib/utils/cn";
import { localName } from "../users/use-user-options";
import {
  apiErrorToFields,
  diffPhotos,
  emptyServiceValues,
  firstErrorField,
  langForErrors,
  omitKey,
  photoToItem,
  publishErrorsToFields,
  serviceToValues,
  snapshot,
  validateDraft,
  valuesToBody,
  type FactRow,
  type ServiceFormValues,
} from "./service-form-utils";
import { searchProviders, useCatalog, usePhotoLimits } from "./use-service-options";

let factSeq = 0;

/* ------------------------------------------------------------------ routes */

/** `/services/new?provider=` — provider picked first, then the form. */
export function NewServiceScreen() {
  const t = useTranslations("services.form");
  const ts = useTranslations("services");
  const [providerId, setProviderId] = useQueryState(
    "provider",
    parseAsString.withOptions({ history: "replace" }),
  );
  const provider = useQuery({
    queryKey: userKeys.detail(providerId ?? ""),
    queryFn: () => getUser(providerId!),
    enabled: !!providerId,
  });
  const option: Option | null = provider.data
    ? {
        value: provider.data.id,
        label: [provider.data.fullName, provider.data.businessName].filter(Boolean).join(" · "),
      }
    : null;

  if (!providerId || provider.isError) {
    return (
      <>
        <PageHeader
          back
          breadcrumb={[{ label: ts("title"), href: "/services" }, { label: t("newTitle") }]}
          title={t("newTitle")}
          subtitle={t("pickProviderSubtitle")}
        />
        <Card className="max-w-[640px]">
          <CardHeader title={t("provider")} subtitle={t("providerFirst")} />
          <CardBody className="flex flex-col gap-3">
            {provider.isError && <Banner tone="red" title={t("providerNotFound")} />}
            <Field label={t("provider")} required>
              <AsyncSelect
                value={null}
                onValueChange={(o) => o && void setProviderId(o.value)}
                queryFn={searchProviders}
                queryKey={[...userKeys.all, "provider-search"]}
                placeholder={t("searchProvider")}
              />
            </Field>
          </CardBody>
        </Card>
      </>
    );
  }
  if (provider.isPending) return <FormSkeleton />;
  if (provider.data.role !== "provider") {
    return (
      <Card>
        <EmptyState
          icon={<UserRound />}
          title={t("notProviderTitle")}
          description={t("notProviderDescription")}
          actions={[
            <Button key="pick" variant="secondary" onClick={() => void setProviderId(null)}>
              {t("pickAnother")}
            </Button>,
          ]}
        />
      </Card>
    );
  }
  return (
    <ServiceForm
      key={providerId}
      initialProvider={option}
      onProviderCleared={() => void setProviderId(null)}
    />
  );
}

/** `/services/:id/edit` (`?missing=` shows publish guard errors after a failed publish from "new"). */
export function EditServiceScreen({ id }: { id: string }) {
  const t = useTranslations("services.form");
  const ts = useTranslations("services");
  const router = useRouter();
  const query = useQuery({ queryKey: serviceKeys.detail(id), queryFn: () => getService(id) });
  if (query.isPending) return <FormSkeleton />;
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: ts("title"), href: "/services" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={ts("detail.notFoundTitle")}
              description={ts("detail.notFoundDescription")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/services")}>
                  {ts("detail.backToServices")}
                </Button>,
              ]}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    );
  }
  return <ServiceForm key={id} service={query.data} title={t("editTitle")} />;
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <CardSkeleton className="h-[90px]" />
      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        <CardSkeleton className="h-[420px]" />
        <CardSkeleton className="h-[300px]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ form */

export function ServiceForm({
  service,
  initialProvider,
  onProviderCleared,
  title,
}: {
  service?: ServiceDetail;
  initialProvider?: Option | null;
  onProviderCleared?: () => void;
  title?: string;
}) {
  const initialValues = useMemo(() => (service ? serviceToValues(service) : emptyServiceValues()), [service]);
  const [base, setBase] = useState(() => snapshot(initialValues));
  const [values, setValues] = useState(initialValues);
  const dirty = snapshot(values) !== base;
  return (
    <UnsavedChangesGuard when={dirty}>
      <ServiceFormInner
        service={service}
        initialProvider={initialProvider}
        onProviderCleared={onProviderCleared}
        title={title}
        values={values}
        setValues={setValues}
        dirty={dirty}
        markSaved={(v) => setBase(snapshot(v))}
      />
    </UnsavedChangesGuard>
  );
}

function ServiceFormInner({
  service,
  initialProvider,
  onProviderCleared,
  title,
  values,
  setValues,
  dirty,
  markSaved,
}: {
  service?: ServiceDetail;
  initialProvider?: Option | null;
  onProviderCleared?: () => void;
  title?: string;
  values: ServiceFormValues;
  setValues: (fn: (v: ServiceFormValues) => ServiceFormValues) => void;
  dirty: boolean;
  markSaved: (v: ServiceFormValues) => void;
}) {
  const t = useTranslations("services.form");
  const ts = useTranslations("services");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const limits = usePhotoLimits();
  const { confirmLeave } = useUnsavedChanges();
  const formRef = useRef<HTMLFormElement>(null);

  const [provider, setProvider] = useState<Option | null>(
    initialProvider ??
      (service
        ? {
            value: service.provider.id,
            label: [service.provider.fullName, service.provider.businessName].filter(Boolean).join(" · "),
          }
        : null),
  );
  const [missingParam, setMissingParam] = useQueryState(
    "missing",
    parseAsString.withOptions({ history: "replace" }),
  );
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    missingParam ? publishErrorsToFields(missingParam.split(","), ts as never) : {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "publish" | null>(null);
  const [errorTick, setErrorTick] = useState(0);

  useEffect(() => {
    if (missingParam) void setMissingParam(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to (and focus) the first field with an error after each failed submit.
  useEffect(() => {
    const first = firstErrorField(errors);
    if (!first) return;
    const id = requestAnimationFrame(() => {
      const root = formRef.current;
      const el =
        root?.querySelector<HTMLElement>(`[data-field="${first}"]`) ??
        root?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el?.matches("input,textarea,select,button")
        ? el
        : el?.querySelector<HTMLElement>("input,textarea,select,button");
      focusable?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorTick]);

  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key as string]) setErrors((cur) => omitKey(cur, key as string));
  };
  const fail = (e: Record<string, string>, banner?: string | null) => {
    setErrors(e);
    setFormError(banner ?? null);
    setErrorTick((n) => n + 1);
  };
  const invalidate = () => queryClient.invalidateQueries({ queryKey: serviceKeys.all });

  const isNew = !service;
  const status = service?.status ?? "draft";

  async function submit(mode: "draft" | "publish") {
    const local = validateDraft(values, t as never, provider?.value ?? null);
    if (Object.keys(local).length) return fail(local, t("fixErrors"));
    setPending(mode);
    setFormError(null);
    setErrors({});
    const body = valuesToBody(values);
    let saved: ServiceDetail | null = service ?? null;
    try {
      if (isNew) {
        saved = await createService({ ...body, providerId: provider!.value, status: "draft" });
      } else {
        const providerChanged = provider!.value !== service.provider.id;
        saved = await updateService(service.id, {
          ...body,
          ...(providerChanged ? { providerId: provider!.value } : {}),
        });
        // Visibility card (edit): apply published / featured toggles.
        if (mode === "draft" && !values.published && status === "published") {
          saved = await serviceAction(service.id, "unpublish");
        }
        if (mode === "draft" && values.published && status === "draft") mode = "publish";
      }
      if (mode === "publish" && saved.status !== "published") {
        saved = await serviceAction(saved.id, saved.status === "hidden" ? "show" : "publish");
      }
      if (!isNew && values.featured !== service.isFeatured && saved.status === "published") {
        saved = await serviceAction(saved.id, values.featured ? "feature" : "unfeature");
      }
      markSaved(values);
      void invalidate();
      toast.success(
        mode === "publish"
          ? t("published", { title: localTitle(saved, locale) })
          : t("saved", { title: localTitle(saved, locale) }),
      );
      router.push(isNew && mode === "draft" ? `/services/${saved.id}/edit` : `/services/${saved.id}`);
    } catch (e) {
      const fields = apiErrorToFields(e, ts as never);
      if (isNew && saved) {
        // Created as a draft but publishing failed: continue on the edit page with the checklist.
        markSaved(values);
        void invalidate();
        toast.info(t("savedAsDraft"));
        const missing =
          e instanceof ApiError && e.code === "SERVICE_PUBLISH_INVALID"
            ? (e.details as { missing?: string[] })?.missing
            : null;
        router.replace(`/services/${saved.id}/edit${missing?.length ? `?missing=${missing.join(",")}` : ""}`);
        return;
      }
      if (Object.keys(fields).length) {
        const publishInvalid = e instanceof ApiError && e.code === "SERVICE_PUBLISH_INVALID";
        fail(fields, publishInvalid ? t("publishInvalid") : e instanceof Error ? e.message : null);
      } else {
        fail({}, e instanceof Error ? e.message : String(e));
      }
      if (!isNew) void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(service.id) });
    } finally {
      setPending(null);
    }
  }

  const cancel = () => confirmLeave(() => router.push(service ? `/services/${service.id}` : "/services"));
  const providerName = provider?.label ?? "";
  const categoryOptions = useMemo(() => {
    const opts = [...catalog.visibleCategoryOptions];
    if (service && !opts.some((o) => o.value === service.category.id)) {
      opts.push({
        value: service.category.id,
        label: `${localName(service.category, locale)} (${t("hiddenCategory")})`,
      });
    }
    return opts;
  }, [catalog.visibleCategoryOptions, service, locale, t]);
  const wilayaOptions = useMemo(() => {
    const opts = [...catalog.openWilayaOptions];
    for (const w of service?.wilayaDetails ?? []) {
      if (!w.isOpen)
        opts.push({
          value: String(w.code),
          label: `${w.code} · ${localName(w, locale)} (${t("closedWilaya")})`,
        });
    }
    return opts;
  }, [catalog.openWilayaOptions, service, locale, t]);

  const bilingualError = (keys: string[]) =>
    Object.fromEntries(keys.filter((k) => errors[k]).map((k) => [k, errors[k]]));
  const textErrors = bilingualError(["title_en", "title_ar", "description_en", "description_ar"]);
  const extraErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith("extra:"))
      .map(([k, m]) => [k.slice(6), m]),
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit("draft");
      }}
    >
      <PageHeader
        back
        breadcrumb={[
          { label: ts("title"), href: "/services" },
          ...(service ? [{ label: localTitle(service, locale), href: `/services/${service.id}` }] : []),
          { label: isNew ? t("newTitle") : t("editCrumb") },
        ]}
        title={title ?? t("newTitle")}
        titleAddon={service ? <StatusBadge domain="service" status={service.status} /> : undefined}
        subtitle={
          isNew ? t("newSubtitle", { provider: providerName }) : t("editSubtitle", { provider: providerName })
        }
        actions={
          <>
            <Button variant="secondary" onClick={cancel} disabled={!!pending}>
              {t("cancel")}
            </Button>
            {status === "published" ? (
              <Button
                type="submit"
                icon={<Check />}
                loading={pending === "draft"}
                disabled={!!pending || (!dirty && !isNew)}
              >
                {t("saveChanges")}
              </Button>
            ) : (
              <>
                <Button type="submit" variant="secondary" loading={pending === "draft"} disabled={!!pending}>
                  {t("saveDraft")}
                </Button>
                <Button
                  icon={<Send />}
                  loading={pending === "publish"}
                  disabled={!!pending}
                  onClick={() => void submit("publish")}
                >
                  {status === "hidden" ? t("showAgain") : t("publish")}
                </Button>
              </>
            )}
          </>
        }
      />

      {formError && (
        <Banner
          tone="red"
          className="mb-4"
          title={formError}
          description={
            Object.keys(errors).length
              ? t("errorCount", { count: Object.keys(errors).filter((k) => !k.startsWith("extra:")).length })
              : undefined
          }
        />
      )}
      {service?.hidden && <Banner tone="amber" className="mb-4" title={t("hiddenNotice")} />}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card data-field="title_en">
            <CardHeader title={t("content")} subtitle={t("contentHint")} />
            <CardBody>
              <BilingualFields
                key={`text-${errorTick}`}
                defaultLang={langForErrors(textErrors)}
                fields={[
                  { name: "title", label: t("titleLabel"), maxLength: 120 },
                  { name: "description", label: t("descriptionLabel"), multiline: true, maxLength: 5000 },
                ]}
                values={values.text}
                errors={textErrors}
                onChange={(k, val) => {
                  setValues((v) => ({ ...v, text: { ...v.text, [k]: val } }));
                  if (errors[k]) setErrors((cur) => omitKey(cur, k));
                }}
              />
            </CardBody>
          </Card>

          <Card data-field="basePrice">
            <CardHeader title={t("priceOptions")} />
            <CardBody className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("basePrice")} required error={errors.basePrice}>
                  <NumberInput
                    name="basePrice"
                    value={values.basePrice}
                    suffix="DA"
                    onValueChange={(n) => set("basePrice", n)}
                  />
                </Field>
                <Field label={t("priceType")} required error={errors.priceType}>
                  <Select
                    value={values.priceType}
                    onChange={(e) => set("priceType", e.target.value as PriceType)}
                    options={PRICE_TYPES.map((p) => ({ value: p, label: ts(`priceTypes.${p}`) }))}
                  />
                </Field>
                <Field label={t("deposit")} hint={t("depositHint")}>
                  <TextInput value={t("depositNone")} disabled readOnly />
                </Field>
              </div>
              <div data-field="extras">
                <p className="mb-2 text-13 font-medium text-ink">{t("extras")}</p>
                <p className="mb-2 text-12 text-muted">{t("extrasHint")}</p>
                <LineItemsEditor
                  bilingual
                  hideSummary
                  value={values.extras}
                  errors={extraErrors}
                  labelPlaceholder={t("extraNameEn")}
                  labelArPlaceholder={t("extraNameAr")}
                  addLabel={t("addExtra")}
                  onChange={(extras) => {
                    set("extras", extras);
                    setErrors((cur) =>
                      Object.fromEntries(
                        Object.entries(cur).filter(([k]) => !k.startsWith("extra:") && k !== "extras"),
                      ),
                    );
                  }}
                />
              </div>
            </CardBody>
          </Card>

          <Card data-field="facts">
            <CardHeader title={t("facts")} subtitle={t("factsHint")} />
            <CardBody>
              <FactsEditor value={values.facts} onChange={(facts) => set("facts", facts)} />
            </CardBody>
          </Card>

          <Card data-field="policy_en">
            <CardHeader title={t("policy")} subtitle={t("policyHint")} />
            <CardBody>
              <BilingualFields
                fields={[
                  {
                    name: "policy",
                    label: t("policyLabel"),
                    multiline: true,
                    required: false,
                    maxLength: 2000,
                  },
                ]}
                values={values.text}
                onChange={(k, val) => setValues((v) => ({ ...v, text: { ...v.text, [k]: val } }))}
              />
            </CardBody>
          </Card>

          <Card id="photos" data-field="photos" className={cn(errors.photos && "border-red")}>
            <CardHeader title={t("photos")} subtitle={t("photosHint", { limit: limits.service })} />
            <CardBody>
              {errors.photos && (
                <p role="alert" className="mb-3 text-12 text-red">
                  {errors.photos}
                </p>
              )}
              {service ? (
                <ServicePhotos
                  service={service}
                  limit={limits.service}
                  maxSizeMb={limits.uploadMb}
                  onUploaded={() => setErrors((cur) => omitKey(cur, "photos"))}
                />
              ) : (
                <p className="text-13 text-muted">{t("photosAfterDraft")}</p>
              )}
            </CardBody>
          </Card>

          <Card id="schedule">
            <CardHeader title={t("schedule")} subtitle={t("scheduleHint")} />
            <CardBody className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div data-field="concurrentClients">
                  <Field label={t("concurrentClients")} hint={t("concurrentClientsHint")} error={errors.concurrentClients}>
                    <NumberInput
                      name="concurrentClients"
                      value={values.concurrentClients}
                      onValueChange={(n) => set("concurrentClients", n)}
                    />
                  </Field>
                </div>
                <div data-field="availablePeriod">
                  <Field label={t("availablePeriod")} hint={t("availablePeriodHint")} error={errors.availablePeriod}>
                    <DateRangeInput
                      aria-label={t("availablePeriod")}
                      value={{ from: values.availableFrom, to: values.availableUntil }}
                      onValueChange={(r) => {
                        set("availableFrom", r.from);
                        set("availableUntil", r.to);
                      }}
                    />
                  </Field>
                </div>
              </div>
              <div data-field="hours" className="flex flex-col gap-3">
                <ToggleRow
                  label={t("hoursToggle")}
                  hint={t("hoursHint")}
                  checked={values.hoursEnabled}
                  onCheckedChange={(c) => set("hoursEnabled", c)}
                />
                {values.hoursEnabled && (
                  <WeeklyHoursEditor value={values.hours} onValueChange={(h) => set("hours", h)} error={errors.hours} />
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title={t("settings")} />
            <CardBody className="flex flex-col gap-4">
              <div data-field="categoryId">
                <Field label={t("category")} required error={errors.categoryId}>
                  <Select
                    name="categoryId"
                    value={values.categoryId}
                    placeholder={t("selectCategory")}
                    onChange={(e) => set("categoryId", e.target.value)}
                    options={categoryOptions}
                  />
                </Field>
              </div>
              <div data-field="providerId">
                <Field
                  label={t("provider")}
                  required
                  error={errors.providerId}
                  hint={isNew ? undefined : t("moveProviderHint")}
                >
                  <AsyncSelect
                    value={provider}
                    onValueChange={(o) => {
                      if (isNew && !o) onProviderCleared?.();
                      setProvider(o);
                    }}
                    queryFn={searchProviders}
                    queryKey={[...userKeys.all, "provider-search"]}
                    placeholder={t("searchProvider")}
                  />
                </Field>
              </div>
              <div data-field="wilayaCodes">
                <Field label={t("wilayas")} required error={errors.wilayaCodes} hint={t("wilayasHint")}>
                  <MultiSelect
                    value={values.wilayaCodes}
                    onValueChange={(w) => set("wilayaCodes", w)}
                    options={wilayaOptions}
                  />
                </Field>
              </div>
              <div data-field="onePerDay">
                <Checkbox
                  checked={values.onePerDay}
                  onCheckedChange={(c) => set("onePerDay", c)}
                  label={t("onePerDay")}
                  description={t("onePerDayHint")}
                />
              </div>
              <Field label={t("maxGuests")} error={errors.maxGuests}>
                <NumberInput
                  name="maxGuests"
                  value={values.maxGuests}
                  onValueChange={(n) => set("maxGuests", n)}
                />
              </Field>
            </CardBody>
          </Card>

          {service && (
            <Card>
              <CardHeader title={t("visibility")} />
              <CardBody className="flex flex-col gap-4">
                {status === "hidden" ? (
                  <p className="text-13 text-muted">{t("hiddenVisibility")}</p>
                ) : (
                  <ToggleRow
                    label={t("publishedToggle")}
                    hint={t("publishedHint")}
                    checked={values.published}
                    onCheckedChange={(c) => set("published", c)}
                  />
                )}
                <ToggleRow
                  label={t("featuredToggle")}
                  hint={t("featuredHint")}
                  checked={values.featured}
                  disabled={!values.published || status !== "published"}
                  onCheckedChange={(c) => set("featured", c)}
                />
              </CardBody>
            </Card>
          )}

          {service && service.publishMissing.length > 0 && (
            <Card>
              <CardHeader title={t("checklist")} />
              <CardBody>
                <ul className="flex flex-col gap-1.5 text-13 text-ink-2">
                  {service.publishMissing.map((m) => (
                    <li key={m}>• {ts(`publishErrors.${m}`)}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (c: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="leading-tight">
        <span className="block text-13 font-medium text-ink">{label}</span>
        <span className="block text-12 text-muted">{hint}</span>
      </span>
      <Toggle aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ facts */

export function FactsEditor({ value, onChange }: { value: FactRow[]; onChange: (rows: FactRow[]) => void }) {
  const t = useTranslations("services.form");
  const update = (id: string, patch: Partial<FactRow>) =>
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && <p className="text-13 text-muted">{t("noFacts")}</p>}
      {value.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput
              aria-label={t("factLabelEn", { n: i + 1 })}
              placeholder={t("factLabelEn", { n: i + 1 })}
              value={r.label_en}
              onChange={(e) => update(r.id, { label_en: e.target.value })}
            />
            <TextInput
              aria-label={t("factLabelAr", { n: i + 1 })}
              placeholder="العنوان"
              dir="rtl"
              lang="ar"
              className="font-arabic"
              value={r.label_ar}
              onChange={(e) => update(r.id, { label_ar: e.target.value })}
            />
            <TextInput
              aria-label={t("factValueEn", { n: i + 1 })}
              placeholder={t("factValueEn", { n: i + 1 })}
              value={r.value_en}
              onChange={(e) => update(r.id, { value_en: e.target.value })}
            />
            <TextInput
              aria-label={t("factValueAr", { n: i + 1 })}
              placeholder="القيمة"
              dir="rtl"
              lang="ar"
              className="font-arabic"
              value={r.value_ar}
              onChange={(e) => update(r.id, { value_ar: e.target.value })}
            />
          </div>
          <IconButton label={t("removeFact")} onClick={() => onChange(value.filter((x) => x.id !== r.id))}>
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus />}
          className="text-brand"
          onClick={() =>
            onChange([
              ...value,
              { id: `fact-new-${++factSeq}`, label_en: "", label_ar: "", value_en: "", value_ar: "" },
            ])
          }
        >
          {t("addFact")}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ photos (saved immediately) */

export function ServicePhotos({
  service,
  limit,
  maxSizeMb,
  resource = "services",
  onUploaded,
}: {
  service: { id: string; photos: ServiceDetail["photos"] };
  limit: number;
  maxSizeMb?: number;
  resource?: "services" | "packs";
  onUploaded?: () => void;
}) {
  const t = useTranslations("services.form");
  const queryClient = useQueryClient();
  const [items, setItems] = useState<PhotoItem[]>(() => service.photos.map(photoToItem));
  const known = useRef(new Set(service.photos.map((p) => p.id)));
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const processing = items.some((p) => p.status === "processing");
  const detailKey =
    resource === "services" ? serviceKeys.detail(service.id) : ["packs", "detail", service.id];

  // Poll the detail while the photo pipeline is compressing; then swap in the ready thumbnails.
  const poll = useQuery({
    queryKey: [...detailKey, "photos-poll"],
    queryFn: async (): Promise<{ photos: ServiceDetail["photos"] }> =>
      resource === "services" ? getService(service.id) : getPack(service.id),
    enabled: processing,
    refetchInterval: (q) =>
      !q.state.data || q.state.data.photos.some((p) => p.processingStatus === "pending") ? 2500 : false,
  });
  // Swap in ready thumbnails as the pipeline finishes (derived, no extra state).
  const shown = useMemo(() => {
    const photos = poll.data?.photos;
    if (!photos) return items;
    return items.map((it) => {
      const p = photos.find((x) => x.id === it.id);
      return p && it.status === "processing" && p.processingStatus !== "pending" ? photoToItem(p) : it;
    });
  }, [items, poll.data]);

  return (
    <div data-testid="service-photos">
      <PhotoUploader
        value={shown}
        limit={limit}
        maxSizeMb={maxSizeMb}
        upload={async (file, onProgress) => {
          onProgress(15);
          try {
            const list = await uploadPhoto(resource, service.id, file);
            const created = list.find((p) => !known.current.has(p.id)) ?? list[list.length - 1];
            known.current.add(created.id);
            onProgress(100);
            onUploaded?.();
            void queryClient.invalidateQueries({ queryKey: detailKey });
            return {
              id: created.id,
              url: created.thumbUrl || created.url,
              processing: created.processingStatus === "pending",
            };
          } catch (e) {
            toast.error(
              e instanceof ApiError && e.code === "PHOTO_LIMIT_REACHED"
                ? t("photoLimit", { limit })
                : e instanceof Error
                  ? e.message
                  : String(e),
            );
            throw e;
          }
        }}
        onChange={(next) => {
          const { removed, reordered, order } = diffPhotos(itemsRef.current, next);
          const prev = itemsRef.current;
          itemsRef.current = next;
          setItems(next);
          const rollback = (e: unknown) => {
            setItems(prev);
            toast.apiError(e);
          };
          for (const id of removed) {
            deletePhoto(resource, service.id, id)
              .then(() => void queryClient.invalidateQueries({ queryKey: detailKey }))
              .catch(rollback);
          }
          if (reordered && !next.some((p) => p.status === "uploading")) {
            reorderPhotos(resource, service.id, order)
              .then(() => void queryClient.invalidateQueries({ queryKey: detailKey }))
              .catch(rollback);
          }
        }}
      />
      <p className="mt-2 text-12 text-faint">{t("photosSaveImmediately")}</p>
    </div>
  );
}
