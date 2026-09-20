"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { FormDrawer } from "@/components/feedback/form-dialog";
import { PriceSummary } from "@/components/domain/price-summary";
import { Field, Select, TextInput, Textarea } from "@/components/forms/fields";
import { NumberInput, SegmentedControl, TimeSelect } from "@/components/forms/inputs";
import { AsyncSelect } from "@/components/forms/select-inputs";
import { toast } from "@/components/feedback/toast";
import { useRouter } from "@/i18n/navigation";
import { createBooking, priceTotals, type BookingLineKind } from "@/lib/api/bookings";
import { listCommunes } from "@/lib/api/catalog";
import { EVENT_TYPES, getPack, listPacks, localPackName, packKeys } from "@/lib/api/packs";
import { flattenSettings, getSettings, settingsKeys } from "@/lib/api/settings";
import { getService, listServices, localTitle, serviceKeys } from "@/lib/api/services";
import { listUsers, userKeys } from "@/lib/api/users";
import { useCatalog } from "../services/use-service-options";
import { AvailabilityPicker } from "./availability-picker";

const opt = z.object({ value: z.string(), label: z.string() }).nullable();
const schema = z
  .object({
    client: opt.refine((v) => v !== null, "required"),
    kind: z.enum(["service", "pack"]),
    service: opt,
    pack: opt,
    eventDate: z.string().min(1, "required"),
    startTime: z.string(),
    endTime: z.string(),
    eventType: z.string().min(1, "required"),
    wilayaCode: z.string().min(1, "required"),
    communeId: z.string(),
    locationText: z.string().max(255),
    guests: z.number().int().min(1).nullable(),
    clientNote: z.string().max(2000),
    extras: z.record(z.string(), z.number().nullable()),
  })
  .refine((v) => (v.kind === "service" ? !!v.service : !!v.pack), { path: ["service"], message: "required" });

type Values = z.input<typeof schema>;

/** Quantity of the main service line from its price type (mirrors the API policy). */
export function serviceQuantity(
  priceType: string | null | undefined,
  guests: number | null,
  start: string,
  end: string,
) {
  if (priceType === "per_person") return Math.max(1, guests ?? 1);
  if (priceType === "per_hour" && start && end) {
    const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    let span = m(end) - m(start);
    if (span <= 0) span += 24 * 60;
    return Math.max(1, Math.ceil(span / 60));
  }
  return 1;
}

export function CreateBookingDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("bookings.create");
  const router = useRouter();
  const settings = useQuery({
    queryKey: settingsKeys.all,
    queryFn: getSettings,
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const flat = settings.data ? flattenSettings(settings.data) : {};
  const feeOf = (key: string) => Number(flat[key]?.value ?? 0);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title={t("title")}
      description={t("subtitle")}
      schema={schema}
      submitLabel={t("submit")}
      footerNote={t("footer")}
      defaultValues={{
        client: null,
        kind: "service",
        service: null,
        pack: null,
        eventDate: "",
        startTime: "",
        endTime: "",
        eventType: "wedding",
        wilayaCode: "",
        communeId: "",
        locationText: "",
        guests: null,
        clientNote: "",
        extras: {},
      }}
      onSubmit={async (v) => {
        const detail = await createBooking({
          clientId: v.client!.value,
          ...(v.kind === "service" ? { serviceId: v.service!.value } : { packId: v.pack!.value }),
          eventDate: v.eventDate,
          startTime: v.startTime || undefined,
          endTime: v.endTime || undefined,
          eventType: v.eventType as (typeof EVENT_TYPES)[number],
          wilayaCode: Number(v.wilayaCode),
          communeId: v.communeId || undefined,
          locationText: v.locationText.trim() || null,
          guests: v.guests ?? undefined,
          clientNote: v.clientNote.trim() || null,
          extras:
            v.kind === "service"
              ? Object.entries(v.extras)
                  .filter(([, q]) => (q ?? 0) > 0)
                  .map(([extraId, quantity]) => ({ extraId, quantity: quantity! }))
              : undefined,
        });
        toast.success(t("created", { reference: detail.reference }));
        router.push(`/bookings/${detail.id}`);
      }}
      fields={(form) => <CreateFields form={form as unknown as UseFormReturn<Values>} feeOf={feeOf} />}
    />
  );
}

function CreateFields({ form, feeOf }: { form: UseFormReturn<Values>; feeOf: (key: string) => number }) {
  const t = useTranslations("bookings.create");
  const tc = useTranslations("common");
  const tp = useTranslations("packs");
  const locale = useLocale();
  const catalog = useCatalog();
  const v = useWatch({ control: form.control }) as Values;
  const serviceId = v.kind === "service" ? v.service?.value : undefined;
  const packId = v.kind === "pack" ? v.pack?.value : undefined;
  const service = useQuery({
    queryKey: serviceKeys.detail(serviceId ?? "none"),
    queryFn: () => getService(serviceId!),
    enabled: !!serviceId,
  });
  const pack = useQuery({
    queryKey: packKeys.detail(packId ?? "none"),
    queryFn: () => getPack(packId!),
    enabled: !!packId,
  });
  const communes = useQuery({
    queryKey: ["communes", v.wilayaCode, "options"],
    queryFn: () => listCommunes(v.wilayaCode!, { limit: 100 }),
    enabled: !!v.wilayaCode,
  });
  const provider =
    v.kind === "service" ? service.data?.provider : v.kind === "pack" ? pack.data?.provider : undefined;
  const err = (name: keyof Values) => (form.formState.errors[name] ? tc("required") : undefined);

  const lines: { kind: BookingLineKind; quantity: number; unitAmount: string; label: string; key: string }[] =
    [];
  if (v.kind === "service" && service.data) {
    lines.push({
      key: "service",
      kind: "service",
      label: localTitle(service.data, locale),
      quantity: serviceQuantity(service.data.priceType, v.guests ?? null, v.startTime ?? "", v.endTime ?? ""),
      unitAmount: service.data.basePrice,
    });
    for (const x of service.data.extras) {
      const q = v.extras?.[x.id] ?? 0;
      if (q && q > 0)
        lines.push({
          key: x.id,
          kind: "extra",
          label: locale === "ar" ? x.nameAr || x.nameEn : x.nameEn,
          quantity: q,
          unitAmount: x.price,
        });
    }
  }
  if (v.kind === "pack" && pack.data) {
    lines.push({
      key: "pack",
      kind: "service",
      label: localPackName(pack.data, locale),
      quantity: 1,
      unitAmount: pack.data.price,
    });
  }
  const fee =
    v.kind === "pack"
      ? feeOf("pack_fee_percent") || feeOf("platform_fee_percent")
      : feeOf("platform_fee_percent");
  const totals = priceTotals(lines, fee);

  return (
    <>
      <Controller
        control={form.control}
        name="client"
        render={({ field }) => (
          <Field label={t("client")} required error={err("client")}>
            <AsyncSelect
              value={field.value ?? null}
              onValueChange={field.onChange}
              queryKey={[...userKeys.all, "client-search"]}
              placeholder={t("clientPlaceholder")}
              queryFn={async (q) =>
                (await listUsers({ role: "client", q: q || undefined, limit: 20 })).data.map((u) => ({
                  value: u.id,
                  label: u.fullName,
                  sub: u.email,
                }))
              }
            />
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="kind"
        render={({ field }) => (
          <SegmentedControl
            aria-label={t("offerKind")}
            value={field.value}
            onValueChange={(k) => {
              field.onChange(k);
              form.setValue("eventDate", "");
            }}
            options={[
              { value: "service", label: t("service") },
              { value: "pack", label: t("pack") },
            ]}
          />
        )}
      />
      {v.kind === "service" ? (
        <Controller
          control={form.control}
          name="service"
          render={({ field }) => (
            <Field label={t("service")} required error={err("service")}>
              <AsyncSelect
                value={field.value ?? null}
                onValueChange={(o) => {
                  field.onChange(o);
                  form.setValue("extras", {});
                }}
                queryKey={[...serviceKeys.all, "booking-search"]}
                placeholder={t("servicePlaceholder")}
                queryFn={async (q) =>
                  (await listServices({ tab: "published", q: q || undefined, limit: 20 })).data.map((s) => ({
                    value: s.id,
                    label: localTitle(s, locale),
                    sub: s.provider.businessName ?? s.provider.fullName,
                  }))
                }
              />
            </Field>
          )}
        />
      ) : (
        <Controller
          control={form.control}
          name="pack"
          render={({ field }) => (
            <Field label={t("pack")} required error={err("service")}>
              <AsyncSelect
                value={field.value ?? null}
                onValueChange={field.onChange}
                queryKey={[...packKeys.all, "booking-search"]}
                placeholder={t("packPlaceholder")}
                queryFn={async (q) =>
                  (await listPacks({ tab: "published", q: q || undefined, limit: 20 })).data.map((p) => ({
                    value: p.id,
                    label: localPackName(p, locale),
                    sub: p.provider.businessName ?? p.provider.fullName,
                  }))
                }
              />
            </Field>
          )}
        />
      )}

      <Controller
        control={form.control}
        name="eventDate"
        render={({ field }) => (
          <Field label={t("date")} required error={err("eventDate")}>
            <div>
              <AvailabilityPicker
                providerId={provider?.id ?? null}
                providerName={provider ? (provider.businessName ?? provider.fullName) : undefined}
                value={field.value}
                onChange={(d) => field.onChange(d)}
              />
            </div>
          </Field>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <Field label={t("start")}>
              <TimeSelect value={field.value} onValueChange={field.onChange} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="endTime"
          render={({ field }) => (
            <Field label={t("end")}>
              <TimeSelect value={field.value} onValueChange={field.onChange} />
            </Field>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={form.control}
          name="eventType"
          render={({ field }) => (
            <Field label={t("eventType")} required>
              <Select
                {...field}
                options={EVENT_TYPES.map((e) => ({ value: e, label: tp(`eventTypes.${e}`) }))}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="guests"
          render={({ field }) => (
            <Field label={t("guests")}>
              <NumberInput value={field.value ?? null} onValueChange={field.onChange} />
            </Field>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={form.control}
          name="wilayaCode"
          render={({ field }) => (
            <Field label={t("wilaya")} required error={err("wilayaCode")}>
              <Select
                {...field}
                placeholder={tc("select")}
                options={catalog.openWilayaOptions}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  form.setValue("communeId", "");
                }}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="communeId"
          render={({ field }) => (
            <Field label={t("commune")}>
              <Select
                {...field}
                disabled={!v.wilayaCode}
                placeholder={tc("select")}
                options={(communes.data?.data ?? []).map((c) => ({
                  value: c.id,
                  label: locale === "ar" ? c.nameAr || c.name : c.name,
                }))}
              />
            </Field>
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="locationText"
        render={({ field }) => (
          <Field label={t("location")}>
            <TextInput {...field} maxLength={255} placeholder={t("locationPlaceholder")} />
          </Field>
        )}
      />
      {v.kind === "service" && (service.data?.extras.length ?? 0) > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-13 font-medium text-ink">{t("extras")}</legend>
          {service.data!.extras.map((x) => (
            <Controller
              key={x.id}
              control={form.control}
              name={`extras.${x.id}`}
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-13 text-ink">
                    {locale === "ar" ? x.nameAr || x.nameEn : x.nameEn}
                  </span>
                  <span className="text-12 text-muted tabular-nums" dir="ltr">
                    {Number(x.price).toLocaleString("en-US").replace(/,/g, " ")} DA
                  </span>
                  <div className="w-20">
                    <NumberInput
                      aria-label={t("extraQuantity", { name: x.nameEn })}
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                    />
                  </div>
                </div>
              )}
            />
          ))}
        </fieldset>
      )}
      <Controller
        control={form.control}
        name="clientNote"
        render={({ field }) => (
          <Field label={t("clientNote")}>
            <Textarea {...field} rows={3} maxLength={2000} />
          </Field>
        )}
      />
      {lines.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border" data-testid="create-totals">
          <PriceSummary
            lines={lines.map((l) => ({
              key: l.key,
              label: l.quantity > 1 ? `${l.label} × ${l.quantity}` : l.label,
              amount: Number(l.unitAmount) * l.quantity,
            }))}
            total={totals.total}
            feePercent={fee}
            feeAmount={totals.feeAmount}
            providerAmount={totals.providerAmount}
          />
          {v.kind === "pack" && <p className="px-[18px] pb-3 text-12 text-muted">{t("packLinesHint")}</p>}
        </div>
      )}
    </>
  );
}
