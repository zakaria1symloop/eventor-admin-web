"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, SearchX, Send, X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { UnsavedChangesGuard, useUnsavedChanges } from "@/components/feedback/unsaved-changes-guard";
import { BilingualFields } from "@/components/forms/bilingual-fields";
import { Field, Select } from "@/components/forms/fields";
import { NumberInput } from "@/components/forms/inputs";
import { AsyncSelect, type Option } from "@/components/forms/select-inputs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  createPack,
  EVENT_TYPES,
  getPack,
  localPackName,
  PACK_PUBLISH_FIELDS,
  packAction,
  packKeys,
  packTotals,
  updatePack,
  type EventType,
  type PackDetail,
  type PackPublishField,
} from "@/lib/api/packs";
import { publishMissing } from "@/lib/api/services";
import { getUser, userKeys } from "@/lib/api/users";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";
import { ServicePhotos } from "../services/service-form";
import { langForErrors, omitKey } from "../services/service-form-utils";
import { searchProviders, useCatalog, usePhotoLimits } from "../services/use-service-options";
import { PACK_MAX_ITEMS, PACK_MIN_ITEMS, ServicePicker, type PickedService } from "./service-picker";

interface PackFormValues {
  text: Record<string, string>;
  eventType: EventType | "";
  wilayaCode: string;
  price: number | null;
  maxGuests: number | null;
  items: PickedService[];
}

const PACK_FIELD_ORDER = [
  "providerId",
  "name_en",
  "name_ar",
  "description_en",
  "description_ar",
  "eventType",
  "wilayaCode",
  "items",
  "price",
];

const PUBLISH_FIELD: Record<PackPublishField, string> = {
  nameEn: "name_en",
  nameAr: "name_ar",
  items: "items",
  unpublishedItems: "items",
  providerBlocked: "providerId",
  providerNotVerified: "providerId",
  priceNotBelowSum: "price",
  wilayaNotCovered: "wilayaCode",
};

/** PACK_PUBLISH_INVALID `details.missing` → `{ field: message }`. */
export function packPublishErrors(missing: string[], t: (k: string) => string) {
  const out: Record<string, string> = {};
  const all: PackPublishField[] = ["nameEn", "providerBlocked", ...PACK_PUBLISH_FIELDS];
  for (const key of all) {
    if (missing.includes(key) && !out[PUBLISH_FIELD[key]])
      out[PUBLISH_FIELD[key]] = t(`publishErrors.${key}`);
  }
  return out;
}

function toValues(p?: PackDetail): PackFormValues {
  return {
    text: {
      name_en: p?.nameEn ?? "",
      name_ar: p?.nameAr ?? "",
      description_en: p?.descriptionEn ?? "",
      description_ar: p?.descriptionAr ?? "",
    },
    eventType: p?.eventType ?? "",
    wilayaCode: p ? String(p.wilaya.code) : "",
    price: p ? Number(p.price) : null,
    maxGuests: p?.maxGuests ?? null,
    items: (p?.items ?? []).map((it) => ({
      id: it.service.id,
      titleEn: it.service.titleEn,
      titleAr: it.service.titleAr,
      price: it.price,
      coverUrl: it.service.coverUrl,
      unavailable: it.availability !== "available",
    })),
  };
}

/* ------------------------------------------------------------------ routes */

export function NewPackScreen() {
  const [providerId] = useQueryState("provider", parseAsString);
  const provider = useQuery({
    queryKey: userKeys.detail(providerId ?? ""),
    queryFn: () => getUser(providerId!),
    enabled: !!providerId,
  });
  if (providerId && provider.isPending) return <FormSkeleton />;
  const initial =
    provider.data?.role === "provider"
      ? {
          value: provider.data.id,
          label: [provider.data.fullName, provider.data.businessName].filter(Boolean).join(" · "),
        }
      : null;
  return <PackForm key={initial?.value ?? "new"} initialProvider={initial} />;
}

export function EditPackScreen({ id }: { id: string }) {
  const t = useTranslations("packs");
  const router = useRouter();
  const query = useQuery({ queryKey: packKeys.detail(id), queryFn: () => getPack(id) });
  if (query.isPending) return <FormSkeleton />;
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader back breadcrumb={[{ label: t("title"), href: "/packs" }, { label: "—" }]} />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={t("detail.notFoundTitle")}
              description={t("detail.notFoundDescription")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/packs")}>
                  {t("detail.backToPacks")}
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
  return <PackForm key={id} pack={query.data} />;
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <CardSkeleton className="h-[80px]" />
      <div className="grid gap-4 lg:grid-cols-[1fr_350px]">
        <CardSkeleton className="h-[420px]" />
        <CardSkeleton className="h-[260px]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ PCK-03 */

export function PackForm({ pack, initialProvider }: { pack?: PackDetail; initialProvider?: Option | null }) {
  const initial = useMemo(() => toValues(pack), [pack]);
  const [values, setValues] = useState(initial);
  const [base, setBase] = useState(() => JSON.stringify(initial));
  const [provider, setProvider] = useState<Option | null>(
    initialProvider ??
      (pack
        ? {
            value: pack.provider.id,
            label: [pack.provider.fullName, pack.provider.businessName].filter(Boolean).join(" · "),
          }
        : null),
  );
  const dirty =
    JSON.stringify(values) !== base ||
    (provider?.value ?? null) !== (pack?.provider.id ?? initialProvider?.value ?? null);
  return (
    <UnsavedChangesGuard when={dirty}>
      <PackFormInner
        pack={pack}
        values={values}
        setValues={setValues}
        provider={provider}
        setProvider={setProvider}
        dirty={dirty}
        markSaved={(v) => setBase(JSON.stringify(v))}
      />
    </UnsavedChangesGuard>
  );
}

function PackFormInner({
  pack,
  values,
  setValues,
  provider,
  setProvider,
  dirty,
  markSaved,
}: {
  pack?: PackDetail;
  values: PackFormValues;
  setValues: (fn: (v: PackFormValues) => PackFormValues) => void;
  provider: Option | null;
  setProvider: (o: Option | null) => void;
  dirty: boolean;
  markSaved: (v: PackFormValues) => void;
}) {
  const t = useTranslations("packs.form");
  const tp = useTranslations("packs");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const limits = usePhotoLimits();
  const { confirmLeave } = useUnsavedChanges();
  const formRef = useRef<HTMLFormElement>(null);
  const [missingParam, setMissingParam] = useQueryState(
    "missing",
    parseAsString.withOptions({ history: "replace" }),
  );
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    missingParam ? packPublishErrors(missingParam.split(","), tp) : {},
  );
  const [formError, setFormError] = useState<string | null>(missingParam ? t("publishInvalid") : null);
  const [pending, setPending] = useState<"draft" | "publish" | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (missingParam) void setMissingParam(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const first = PACK_FIELD_ORDER.find((k) => errors[k]) ?? Object.keys(errors)[0];
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input,textarea,select,button")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const providerQuery = useQuery({
    queryKey: userKeys.detail(provider?.value ?? ""),
    queryFn: () => getUser(provider!.value),
    enabled: !!provider,
    staleTime: 60_000,
  });
  const totals = packTotals(
    values.items.map((i) => i.price),
    values.price,
  );
  const isNew = !pack;
  const status = pack?.status ?? "draft";

  const set = <K extends keyof PackFormValues>(key: K, value: PackFormValues[K], errorKey: string = key) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[errorKey]) setErrors((cur) => omitKey(cur, errorKey));
  };
  const fail = (e: Record<string, string>, banner: string | null) => {
    setErrors(e);
    setFormError(banner);
    setTick((n) => n + 1);
  };

  const p = providerQuery.data;
  const checklist: { key: PackPublishField | "photos"; ok: boolean; optional?: boolean }[] = [
    { key: "items", ok: values.items.length >= PACK_MIN_ITEMS && values.items.length <= PACK_MAX_ITEMS },
    { key: "providerNotVerified", ok: !!p && p.verificationStatus === "verified" && p.status === "active" },
    { key: "nameAr", ok: !!values.text.name_en.trim() && !!values.text.name_ar.trim() },
    { key: "unpublishedItems", ok: values.items.length > 0 && !values.items.some((i) => i.unavailable) },
    { key: "priceNotBelowSum", ok: totals.belowSum },
    { key: "photos", ok: (pack?.photos.length ?? 0) > 0, optional: true },
  ];

  async function submit(mode: "draft" | "publish") {
    const local: Record<string, string> = {};
    if (!provider) local.providerId = t("errors.provider");
    if (!values.text.name_en.trim()) local.name_en = t("errors.nameEn");
    if (!values.eventType) local.eventType = t("errors.eventType");
    if (!values.wilayaCode) local.wilayaCode = t("errors.wilaya");
    if (values.price === null || values.price <= 0) local.price = t("errors.price");
    if (values.items.length < PACK_MIN_ITEMS || values.items.length > PACK_MAX_ITEMS)
      local.items = t("errors.items", { min: PACK_MIN_ITEMS, max: PACK_MAX_ITEMS });
    if (Object.keys(local).length) return fail(local, t("fixErrors"));

    setPending(mode);
    setErrors({});
    setFormError(null);
    const body = {
      providerId: provider!.value,
      nameEn: values.text.name_en.trim(),
      nameAr: values.text.name_ar.trim(),
      descriptionEn: values.text.description_en.trim() || null,
      descriptionAr: values.text.description_ar.trim() || null,
      eventType: values.eventType as EventType,
      wilayaCode: Number(values.wilayaCode),
      price: String(values.price),
      maxGuests: values.maxGuests,
      serviceIds: values.items.map((i) => i.id),
    };
    let saved: PackDetail | null = null;
    try {
      saved = pack ? await updatePack(pack.id, body) : await createPack(body);
      if (mode === "publish" && saved.status !== "published") saved = await packAction(saved.id, "publish");
      markSaved(values);
      void queryClient.invalidateQueries({ queryKey: packKeys.all });
      toast.success(
        mode === "publish"
          ? t("published", { name: localPackName(saved, locale) })
          : t("saved", { name: localPackName(saved, locale) }),
      );
      router.push(`/packs/${saved.id}`);
    } catch (e) {
      const missing = publishMissing(e, "PACK_PUBLISH_INVALID");
      if (isNew && saved) {
        markSaved(values);
        void queryClient.invalidateQueries({ queryKey: packKeys.all });
        toast.info(t("savedAsDraft"));
        router.replace(`/packs/${saved.id}/edit${missing?.length ? `?missing=${missing.join(",")}` : ""}`);
        return;
      }
      if (missing) return fail(packPublishErrors(missing, tp), t("publishInvalid"));
      if (e instanceof ApiError) {
        const map: Record<string, string> = {
          PACK_SERVICE_OTHER_PROVIDER: "items",
          PACK_SERVICE_NOT_FOUND: "items",
          WILAYA_CLOSED: "wilayaCode",
          NOT_A_PROVIDER: "providerId",
        };
        if (map[e.code]) return fail({ [map[e.code]]: e.message }, e.message);
        const fields: Record<string, string> = {};
        const names: Record<string, string> = {
          nameEn: "name_en",
          nameAr: "name_ar",
          serviceIds: "items",
          descriptionEn: "description_en",
          descriptionAr: "description_ar",
        };
        for (const d of e.fieldErrors)
          fields[names[d.field.split(/[.[]/)[0]] ?? d.field.split(/[.[]/)[0]] = d.message;
        return fail(fields, e.message);
      }
      fail({}, e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  const cancel = () => confirmLeave(() => router.push(pack ? `/packs/${pack.id}` : "/packs"));
  const textErrors = Object.fromEntries(
    ["name_en", "name_ar", "description_en", "description_ar"]
      .filter((k) => errors[k])
      .map((k) => [k, errors[k]]),
  );
  const providerBlockedOrUnverified = p && (p.status !== "active" || p.verificationStatus !== "verified");

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
          { label: tp("title"), href: "/packs" },
          ...(pack ? [{ label: localPackName(pack, locale), href: `/packs/${pack.id}` }] : []),
          { label: isNew ? t("newTitle") : t("editCrumb") },
        ]}
        title={isNew ? t("newTitle") : t("editTitle")}
        subtitle={t("subtitle", { min: PACK_MIN_ITEMS, max: PACK_MAX_ITEMS })}
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
                disabled={!!pending || !dirty}
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
                  {t("publish")}
                </Button>
              </>
            )}
          </>
        }
      />
      {formError && <Banner tone="red" className="mb-4" title={formError} />}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title={t("details")} />
            <CardBody className="flex flex-col gap-4">
              <div data-field="providerId">
                <Field label={t("provider")} required error={errors.providerId} hint={t("providerHint")}>
                  <AsyncSelect
                    value={provider}
                    onValueChange={(o) => {
                      setProvider(o);
                      // Items belong to one provider: switching clears them.
                      if (o?.value !== provider?.value) set("items", [], "items");
                      if (errors.providerId) setErrors((cur) => omitKey(cur, "providerId"));
                    }}
                    queryFn={searchProviders}
                    queryKey={[...userKeys.all, "provider-search"]}
                    placeholder={t("searchProvider")}
                  />
                </Field>
                {providerBlockedOrUnverified && (
                  <p className="mt-1.5 text-12 text-amber">{t("providerNotReady")}</p>
                )}
              </div>
              <div data-field="name_en">
                <BilingualFields
                  key={`names-${tick}`}
                  defaultLang={langForErrors(textErrors)}
                  fields={[
                    { name: "name", label: t("name"), maxLength: 120 },
                    {
                      name: "description",
                      label: t("description"),
                      multiline: true,
                      required: false,
                      maxLength: 2000,
                    },
                  ]}
                  values={values.text}
                  errors={textErrors}
                  onChange={(k, val) => {
                    setValues((v) => ({ ...v, text: { ...v.text, [k]: val } }));
                    if (errors[k]) setErrors((cur) => omitKey(cur, k));
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div data-field="eventType">
                  <Field label={t("eventType")} required error={errors.eventType}>
                    <Select
                      value={values.eventType}
                      placeholder={t("select")}
                      onChange={(e) => set("eventType", e.target.value as EventType)}
                      options={EVENT_TYPES.map((e) => ({ value: e, label: tp(`eventTypes.${e}`) }))}
                    />
                  </Field>
                </div>
                <div data-field="wilayaCode">
                  <Field label={t("wilaya")} required error={errors.wilayaCode} hint={t("wilayaHint")}>
                    <Select
                      value={values.wilayaCode}
                      placeholder={t("select")}
                      onChange={(e) => set("wilayaCode", e.target.value)}
                      options={[
                        ...catalog.openWilayaOptions,
                        ...(pack &&
                        !catalog.openWilayaOptions.some((o) => o.value === String(pack.wilaya.code))
                          ? [
                              {
                                value: String(pack.wilaya.code),
                                label: `${pack.wilaya.code} · ${pack.wilaya.name}`,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card data-field="items" className={cn(errors.items && "border-red")}>
            <CardHeader title={t("services")} subtitle={t("servicesHint")} />
            <CardBody>
              <ServicePicker
                providerId={provider?.value ?? null}
                providerName={provider?.label}
                value={values.items}
                error={errors.items}
                onChange={(items) => set("items", items)}
              />
            </CardBody>
          </Card>

          <Card id="photos">
            <CardHeader title={t("photos")} subtitle={t("photosHint", { limit: limits.pack })} />
            <CardBody>
              {pack ? (
                <ServicePhotos
                  service={pack}
                  resource="packs"
                  limit={limits.pack}
                  maxSizeMb={limits.uploadMb}
                />
              ) : (
                <p className="text-13 text-muted">{t("photosAfterDraft")}</p>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <PackPriceCard
            sum={totals.sum}
            price={values.price}
            maxGuests={values.maxGuests}
            error={errors.price}
            onPrice={(n) => set("price", n)}
            onMaxGuests={(n) => set("maxGuests", n)}
          />
          <Card>
            <CardHeader title={t("checklist")} />
            <CardBody>
              <ul className="flex flex-col gap-2 text-13" aria-label={t("checklist")}>
                {checklist.map((c) => (
                  <li
                    key={c.key}
                    className={cn(
                      "flex items-center gap-2",
                      c.ok ? "text-ink-2" : c.optional ? "text-muted" : "text-ink",
                    )}
                  >
                    {c.ok ? (
                      <Check className="size-4 shrink-0 text-green" aria-hidden />
                    ) : (
                      <X
                        className={cn("size-4 shrink-0", c.optional ? "text-faint" : "text-red")}
                        aria-hidden
                      />
                    )}
                    <span>
                      {tp(`checklist.${c.key}`)}
                      <span className="sr-only">{c.ok ? t("done") : t("todo")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </form>
  );
}

/** Price card: services separately, pack price, live savings, max guests. */
export function PackPriceCard({
  sum,
  price,
  maxGuests,
  error,
  onPrice,
  onMaxGuests,
}: {
  sum: number;
  price: number | null;
  maxGuests: number | null;
  error?: string;
  onPrice: (n: number | null) => void;
  onMaxGuests: (n: number | null) => void;
}) {
  const t = useTranslations("packs.form");
  const locale = useLocale();
  const totals = packTotals([sum], price);
  return (
    <Card>
      <CardHeader title={t("price")} />
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-13">
          <span className="text-muted">{t("separately")}</span>
          <span className="font-semibold text-ink tabular-nums" dir="ltr" data-testid="pack-sum">
            {formatMoney(sum, locale)}
          </span>
        </div>
        <div data-field="price">
          <Field
            label={t("packPrice")}
            required
            error={error}
            hint={
              <span
                data-testid="pack-savings"
                className={cn(price !== null && !totals.belowSum && sum > 0 && "text-red")}
              >
                {price === null || sum === 0
                  ? t("savingsEmpty")
                  : totals.belowSum
                    ? t("clientSaves", {
                        amount: formatMoney(totals.savings, locale),
                        percent: totals.percent,
                      })
                    : t("notBelow")}
              </span>
            }
          >
            <NumberInput value={price} suffix="DA" onValueChange={onPrice} />
          </Field>
        </div>
        <Field label={t("maxGuests")}>
          <NumberInput value={maxGuests} onValueChange={onMaxGuests} />
        </Field>
      </CardBody>
    </Card>
  );
}
