"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Info, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { Field, Select, Textarea, TextInput, Toggle } from "@/components/forms/fields";
import { NumberInput } from "@/components/forms/inputs";
import { BilingualFields } from "@/components/forms/bilingual-fields";
import { DiffList, FormFooter, type DiffRow } from "@/components/forms/editors";
import { Link } from "@/i18n/navigation";
import {
  confirmDiff,
  flattenSettings,
  getSettings,
  settingsKeys,
  staleKeys,
  updateSettings,
  type InvoiceIssuer,
  type SettingDiff,
  type SettingItem,
  type SettingValue,
  type Settings,
  type SettingSectionKey,
} from "@/lib/api/settings";
import { ApiError, type ValidationDetail } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

/* ------------------------------------------------------------------ config */

type Unit = "percent" | "hours" | "days" | "photos" | "files" | "mb" | "px" | null;

const UNITS: Record<string, Unit> = {
  platform_fee_percent: "percent",
  pack_fee_percent: "percent",
  booking_reply_deadline_hours: "hours",
  booking_min_notice_days: "days",
  dispute_window_hours: "hours",
  review_open_after_hours: "hours",
  review_window_days: "days",
  review_edit_hours: "hours",
  max_photos_per_service: "photos",
  max_photos_per_pack: "photos",
  max_photo_upload_mb: "mb",
  photo_max_dimension_px: "px",
  photo_quality: "percent",
  max_document_upload_mb: "mb",
  max_dispute_evidence_files: "files",
};

/** Bookings: the cancellation policy info row sits after the minimum notice. */
const INFO_AFTER: Partial<Record<string, "cancellationPolicy">> = {
  booking_min_notice_days: "cancellationPolicy",
};

const INVOICE_FIELDS: (keyof InvoiceIssuer)[] = ["name", "address", "nif", "rc", "email", "phone"];

export type Draft = Record<string, SettingValue>;

/** Type checks the API runs on a value (all mean "this value has the wrong kind"). */
const WRONG_TYPE_CODES = new Set(["IS_BOOLEAN", "IS_STRING", "IS_ARRAY", "IS_OBJECT"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function toDraft(items: SettingItem[]): Draft {
  return Object.fromEntries(items.map((i) => [i.key, i.value]));
}

function toLoadedAt(items: SettingItem[]): Record<string, string | null> {
  return Object.fromEntries(items.map((i) => [i.key, i.updatedAt]));
}

/** A 409 STALE_UPDATE on this card: the keys someone else changed, and whether the admin reloaded since. */
interface Conflict {
  keys: string[];
  reloaded: boolean;
}

/* ------------------------------------------------------------------ section */

export function SettingsSectionCard({
  sectionKey,
  items,
  onDirtyChange,
  icon,
}: {
  sectionKey: SettingSectionKey;
  items: SettingItem[];
  onDirtyChange: (key: string, dirty: boolean) => void;
  icon?: ReactNode;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const baseJson = JSON.stringify(items.map((i) => [i.key, i.value, i.updatedAt]));
  const [lastBase, setLastBase] = useState(baseJson);
  const [lastItems, setLastItems] = useState(items);
  const [draft, setDraft] = useState<Draft>(() => toDraft(items));
  // L-07: the `updatedAt` each field's draft was edited against, sent as `expectedUpdatedAt`.
  const [loadedAt, setLoadedAt] = useState(() => toLoadedAt(items));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [diff, setDiff] = useState<SettingDiff[] | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [reloading, setReloading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  if (baseJson !== lastBase) {
    // Fresh server values (a save here or in another card, a reload). Untouched fields take them;
    // fields the admin edited keep the unsaved input *and* the `updatedAt` it was based on, so a save
    // after someone else's change still gets 409 STALE_UPDATE instead of silently overwriting it.
    const prev = toDraft(lastItems);
    const nextDraft: Draft = {};
    const nextLoadedAt: Record<string, string | null> = {};
    for (const item of items) {
      const edited = item.key in draft && !same(prev[item.key], draft[item.key]);
      const keep = edited && !same(draft[item.key], item.value);
      nextDraft[item.key] = keep ? draft[item.key] : item.value;
      nextLoadedAt[item.key] = keep ? (loadedAt[item.key] ?? null) : item.updatedAt;
    }
    setLastBase(baseJson);
    setLastItems(items);
    setDraft(nextDraft);
    setLoadedAt(nextLoadedAt);
    // Keep field errors only on fields that still hold unsaved input (`invoice_issuer.nif` → `invoice_issuer`).
    const fresh = toDraft(items);
    setErrors((cur) =>
      Object.fromEntries(
        Object.entries(cur).filter(([field]) => {
          const key = field.split(".")[0];
          return key in nextDraft && !same(nextDraft[key], fresh[key]);
        }),
      ),
    );
  }

  const base = toDraft(items);
  const changedKeys = items.map((i) => i.key).filter((k) => !same(base[k], draft[k]));
  const dirty = changedKeys.length > 0;
  useEffect(() => {
    onDirtyChange(sectionKey, dirty);
  }, [dirty, sectionKey, onDirtyChange]);

  const invalid = changedKeys.some((k) => draft[k] === null || draft[k] === undefined);

  const save = useMutation({
    mutationFn: (opts: { confirm?: boolean; note?: string }) =>
      updateSettings({
        values: Object.fromEntries(changedKeys.map((k) => [k, draft[k]])),
        // Rule (a), "same setting only": the API compares only the keys sent, so editing different
        // fields in two tabs saves both; the same field changed meanwhile gives 409 STALE_UPDATE.
        expectedUpdatedAt: Object.fromEntries(changedKeys.map((k) => [k, loadedAt[k] ?? null])),
        ...(opts.confirm ? { confirm: true } : {}),
        ...(opts.note ? { note: opts.note } : {}),
      }),
    onSuccess: (data: Settings) => {
      setConflict(null);
      queryClient.setQueryData(settingsKeys.detail(), data);
      toast.success(t("saved", { section: t(`sections.${sectionKey}`) }));
    },
  });

  /** 409 STALE_UPDATE: nothing was saved; keep the admin's input and offer Reload. */
  function showConflict(keys: string[]) {
    setConflict({ keys: keys.length > 0 ? keys : changedKeys, reloaded: false });
  }

  /** Load the latest values, keep the admin's input on top (re-apply by saving, or discard). */
  async function reload() {
    if (!conflict) return;
    setReloading(true);
    try {
      const fresh = flattenSettings(
        await queryClient.fetchQuery({ queryKey: settingsKeys.detail(), queryFn: getSettings, staleTime: 0 }),
      );
      // The admin now sees the latest values: saving re-applies their input over them.
      setLoadedAt((cur) => ({
        ...cur,
        ...Object.fromEntries(conflict.keys.filter((k) => fresh[k]).map((k) => [k, fresh[k].updatedAt])),
      }));
      setConflict({ keys: conflict.keys, reloaded: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setReloading(false);
    }
  }

  function discard() {
    setDraft(base);
    setLoadedAt(toLoadedAt(items));
    setErrors({});
    setFormError(null);
    setConflict(null);
  }

  function handleError(e: unknown): boolean {
    const d = confirmDiff(e);
    if (d) {
      setDiff(d.length > 0 ? d : changedKeys.map((k) => ({ key: k, old: base[k], new: draft[k] })));
      return true;
    }
    const stale = staleKeys(e);
    if (stale) {
      showConflict(stale);
      return true;
    }
    if (e instanceof ApiError && e.fieldErrors.length > 0) {
      setErrors(
        Object.fromEntries(e.fieldErrors.map((f) => [f.field.replace(/^values\./, ""), fieldMessage(f)])),
      );
      return true;
    }
    return false;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setErrors({});
    setFormError(null);
    try {
      await save.mutateAsync({});
    } catch (err) {
      if (!handleError(err)) setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  const set = (key: string, value: SettingValue) => setDraft((d) => ({ ...d, [key]: value }));

  const lastChanged = items
    .filter((i) => i.updatedBy && i.updatedAt)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];

  /**
   * L-08: VALIDATION_FAILED `details[]` (`values.<key>` + code) → a readable EN/AR message. Limits come from the
   * setting itself (`GET /admin/settings`), else from the API's message (nested fields like invoice_issuer.nif).
   */
  function fieldMessage(f: ValidationDetail): string {
    const field = f.field.replace(/^values\./, "");
    const key = field.split(".")[0];
    const item = items.find((i) => i.key === key);
    const fromMessage = f.message.match(/(\d+(?:\.\d+)?)(?!.*\d)/)?.[1] ?? "";
    const limit = (v: number | null | undefined) =>
      String(v !== null && v !== undefined && field === key ? (display(key, v) ?? v) : fromMessage);
    const code = WRONG_TYPE_CODES.has(f.code)
      ? "WRONG_TYPE"
      : f.code === "REQUIRED"
        ? "IS_NOT_EMPTY"
        : f.code;
    const k = `validation.${code}`;
    if (!t.has(k)) return f.message;
    return t(k, { min: limit(item?.min), max: limit(item?.max), maxLength: limit(item?.maxLength) });
  }

  function label(key: string) {
    return t.has(`fields.${key}.label`) ? t(`fields.${key}.label`) : key;
  }
  function display(key: string, v: unknown): ReactNode {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "boolean") return v ? t("on") : t("off");
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    const unit = UNITS[key];
    return unit ? `${v} ${t(`units.${unit}`)}` : String(v);
  }
  const diffRows: DiffRow[] = (diff ?? []).flatMap((d) => {
    if (d.key === "invoice_issuer" && d.old && d.new && typeof d.new === "object") {
      const o = d.old as Record<string, unknown>;
      const n = d.new as Record<string, unknown>;
      return INVOICE_FIELDS.filter((f) => !same(o[f], n[f])).map((f) => ({
        label: `${label("invoice_issuer")} · ${t(`invoice.${f}`)}`,
        old: display("", o[f]),
        new: display("", n[f]),
      }));
    }
    return [{ label: label(d.key), old: display(d.key, d.old), new: display(d.key, d.new) }];
  });

  const formId = `settings-${sectionKey}`;

  return (
    <Card id={sectionKey} className="scroll-mt-24 overflow-hidden">
      <CardHeader title={t(`sections.${sectionKey}`)} subtitle={t(`sectionHints.${sectionKey}`)} />
      <form id={formId} onSubmit={submit} noValidate>
        {(conflict || formError) && (
          <div className="flex flex-col gap-2 px-[18px] pt-3">
            {conflict &&
              (conflict.reloaded ? (
                <Banner
                  tone="amber"
                  title={t("staleReloadedTitle")}
                  description={
                    <>
                      <ul className="list-inside list-disc">
                        {conflict.keys
                          .map((k) => items.find((i) => i.key === k))
                          .filter((i): i is SettingItem => !!i)
                          .map((i) => (
                            <li key={i.key}>
                              {i.updatedBy
                                ? t("staleKeyNowBy", {
                                    field: label(i.key),
                                    value: String(display(i.key, i.value) ?? "—"),
                                    name: i.updatedBy.fullName,
                                  })
                                : t("staleKeyNow", {
                                    field: label(i.key),
                                    value: String(display(i.key, i.value) ?? "—"),
                                  })}
                            </li>
                          ))}
                      </ul>
                      <p className="mt-1">{t("staleReloadedDescription")}</p>
                    </>
                  }
                  action={
                    <Button size="sm" variant="secondary" onClick={discard}>
                      {t("discardMine")}
                    </Button>
                  }
                />
              ) : (
                <Banner
                  tone="amber"
                  title={t("staleTitle")}
                  description={t("staleDescription")}
                  action={
                    <Button size="sm" variant="secondary" loading={reloading} onClick={() => void reload()}>
                      {t("reload")}
                    </Button>
                  }
                />
              ))}
            {formError && <Banner tone="red" title={formError} />}
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex items-center gap-2 px-[18px] py-4 text-13 text-muted">
            {icon ?? <Info className="size-4" aria-hidden />}
            {t("noSettings")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {sectionKey === "maintenance" ? (
              <MaintenanceRows items={items} draft={draft} set={set} errors={errors} label={label} />
            ) : sectionKey === "legal" ? (
              <LegalRows draft={draft} set={set} errors={errors} />
            ) : (
              items.map((item) => (
                <SettingRowFragment
                  key={item.key}
                  item={item}
                  value={draft[item.key]}
                  onChange={(v) => set(item.key, v)}
                  errors={errors}
                  label={label(item.key)}
                />
              ))
            )}
          </ul>
        )}
      </form>
      {items.length > 0 && (
        <FormFooter
          form={formId}
          sticky={false}
          isDirty={dirty}
          isValid={!invalid}
          isSubmitting={save.isPending}
          onDiscard={discard}
          note={
            lastChanged ? (
              <Link
                href={`/activity-log?objectType=settings`}
                className="inline-flex items-center gap-1 hover:text-brand hover:underline"
              >
                <History className="size-3.5" aria-hidden />
                {t("lastChanged", {
                  date: formatDate(lastChanged.updatedAt!, locale),
                  name: lastChanged.updatedBy!.fullName,
                })}
              </Link>
            ) : undefined
          }
        />
      )}
      <ConfirmDialog
        open={diff !== null}
        onOpenChange={(o) => !o && setDiff(null)}
        tone="warning"
        icon={<SlidersHorizontal />}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        messageField={{ label: t("confirmNote"), placeholder: t("confirmNotePlaceholder") }}
        confirmLabel={t("confirmSave")}
        footerNote={tc("savedInActivityLog")}
        onConfirm={async ({ message }) => {
          try {
            await save.mutateAsync({ confirm: true, note: message.trim() || undefined });
          } catch (err) {
            const stale = staleKeys(err);
            if (stale) {
              showConflict(stale);
              return;
            }
            throw err;
          }
        }}
      >
        <DiffList rows={diffRows} />
      </ConfirmDialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ rows */

function Row({
  label,
  hint,
  control,
  error,
  htmlFor,
  stacked,
}: {
  label: ReactNode;
  hint?: ReactNode;
  control?: ReactNode;
  error?: string;
  htmlFor?: string;
  stacked?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex gap-x-4 gap-y-2 px-[18px] py-3",
        stacked ? "flex-col" : "flex-wrap items-center justify-between",
      )}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-14 font-medium text-ink">
          {label}
        </label>
        {hint && <p className="text-12 text-muted">{hint}</p>}
        {error && (
          <p role="alert" className="mt-0.5 text-12 text-red">
            {error}
          </p>
        )}
      </div>
      {control && <div className={cn(!stacked && "shrink-0")}>{control}</div>}
    </li>
  );
}

function SettingRowFragment(props: {
  item: SettingItem;
  value: SettingValue;
  onChange: (v: SettingValue) => void;
  errors: Record<string, string>;
  label: string;
}) {
  const t = useTranslations("settings");
  const info = INFO_AFTER[props.item.key];
  return (
    <>
      <SettingRow {...props} />
      {info && <Row label={t(`info.${info}.label`)} hint={t(`info.${info}.hint`)} />}
    </>
  );
}

function SettingRow({
  item,
  value,
  onChange,
  errors,
  label,
}: {
  item: SettingItem;
  value: SettingValue;
  onChange: (v: SettingValue) => void;
  errors: Record<string, string>;
  label: string;
}) {
  const t = useTranslations("settings");
  const id = `setting-${item.key}`;
  const hint = t.has(`fields.${item.key}.hint`) ? t(`fields.${item.key}.hint`) : undefined;
  const error = errors[item.key];
  const range =
    item.min !== null && item.max !== null ? t("range", { min: item.min, max: item.max }) : undefined;

  switch (item.type) {
    case "integer":
    case "decimal": {
      const unit = UNITS[item.key];
      return (
        <Row
          label={label}
          hint={hint}
          error={error ?? (value === null ? t("required") : undefined)}
          htmlFor={id}
          control={
            <div className="w-36">
              <NumberInput
                className={unit && unit !== "percent" && unit !== "px" && unit !== "mb" ? "pe-16" : undefined}
                id={id}
                value={typeof value === "number" ? value : null}
                onValueChange={(n) => onChange(n === null ? (null as never) : n)}
                suffix={unit ? t(`units.${unit}`) : undefined}
                aria-invalid={error ? true : undefined}
                title={range}
              />
            </div>
          }
        />
      );
    }
    case "boolean":
      return (
        <Row
          label={label}
          hint={hint}
          error={error}
          control={<Toggle id={id} aria-label={label} checked={!!value} onCheckedChange={onChange} />}
        />
      );
    case "enum_list": {
      const options = item.options ?? [];
      const list = Array.isArray(value) ? value : [];
      if (item.key === "languages_required") {
        // Figma: one row per language with a "required" toggle.
        return (
          <>
            {options.map((o) => {
              const on = list.includes(o);
              const name = t.has(`options.${o}`) ? t(`options.${o}`) : o;
              return (
                <Row
                  key={o}
                  label={name}
                  hint={t(`languageHints.${o}`)}
                  error={
                    o === options[0] ? (error ?? (list.length === 0 ? t("pickOne") : undefined)) : undefined
                  }
                  control={
                    <Toggle
                      aria-label={t("languageRequired", { language: name })}
                      checked={on}
                      onCheckedChange={(next) =>
                        onChange(
                          next
                            ? options.filter((x) => x === o || list.includes(x))
                            : list.filter((x) => x !== o),
                        )
                      }
                    />
                  }
                />
              );
            })}
          </>
        );
      }
      return (
        <Row
          label={label}
          hint={hint}
          error={error ?? (list.length === 0 ? t("pickOne") : undefined)}
          control={
            <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
              {options.map((o) => {
                const on = list.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-pill border px-2.5 text-12 font-medium transition-colors",
                      on
                        ? "border-brand/25 bg-brand-soft text-brand"
                        : "border-border bg-surface text-muted hover:bg-canvas",
                    )}
                  >
                    <span aria-hidden className={cn("size-1.5 rounded-full", on ? "bg-brand" : "bg-faint")} />
                    {t.has(`options.${o}`) ? t(`options.${o}`) : o.toUpperCase()}
                  </button>
                );
              })}
            </div>
          }
        />
      );
    }
    case "text":
      return (
        <Row
          stacked
          label={label}
          hint={hint}
          error={error}
          htmlFor={id}
          control={
            <Textarea
              id={id}
              rows={12}
              value={String(value ?? "")}
              maxLength={item.maxLength ?? undefined}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange(e.target.value)}
            />
          }
        />
      );
    case "object": {
      const v = (value ?? {}) as Record<string, string>;
      return (
        <Row
          stacked
          label={label}
          hint={hint}
          control={
            <div className="grid gap-3 sm:grid-cols-2">
              {INVOICE_FIELDS.map((f) => (
                <Field
                  key={f}
                  label={t(`invoice.${f}`)}
                  error={errors[`${item.key}.${f}`]}
                  className={f === "address" || f === "name" ? "sm:col-span-1" : undefined}
                >
                  <TextInput
                    value={v[f] ?? ""}
                    dir={f === "email" || f === "phone" || f === "nif" || f === "rc" ? "ltr" : undefined}
                    placeholder={f === "nif" || f === "rc" ? t("toBeProvided") : undefined}
                    onChange={(e) => onChange({ ...v, [f]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
          }
        />
      );
    }
    default: {
      if (item.key === "currency") {
        return (
          <Row
            label={label}
            hint={hint}
            error={error}
            htmlFor={id}
            control={
              <div className="w-56">
                <Select
                  id={id}
                  value={String(value ?? "")}
                  onChange={(e) => onChange(e.target.value)}
                  options={[{ value: "DZD", label: t("currencyDzd") }]}
                />
              </div>
            }
          />
        );
      }
      return (
        <Row
          label={label}
          hint={hint}
          error={error}
          htmlFor={id}
          control={
            <div className={item.type === "version" ? "w-32" : "w-72 max-w-full"}>
              <TextInput
                id={id}
                type={item.type === "email" ? "email" : item.type === "url" ? "url" : "text"}
                dir={item.type === "string" ? undefined : "ltr"}
                value={String(value ?? "")}
                maxLength={item.maxLength ?? undefined}
                aria-invalid={error ? true : undefined}
                onChange={(e) => onChange(e.target.value)}
              />
            </div>
          }
        />
      );
    }
  }
}

function MaintenanceRows({
  items,
  draft,
  set,
  errors,
  label,
}: {
  items: SettingItem[];
  draft: Draft;
  set: (key: string, v: SettingValue) => void;
  errors: Record<string, string>;
  label: (key: string) => string;
}) {
  const t = useTranslations("settings");
  const messageKeys = new Set(["maintenance_message_en", "maintenance_message_ar"]);
  const others = items.filter((i) => !messageKeys.has(i.key));
  const hasMessages = items.some((i) => messageKeys.has(i.key));
  return (
    <>
      {others.map((item) => (
        <SettingRow
          key={item.key}
          item={item}
          value={draft[item.key]}
          onChange={(v) => set(item.key, v)}
          errors={errors}
          label={label(item.key)}
        />
      ))}
      {hasMessages && (
        <Row
          stacked
          label={t("fields.maintenance_message.label")}
          hint={t("fields.maintenance_message.hint")}
          control={
            <BilingualFields
              fields={[
                {
                  name: "maintenance_message",
                  label: t("fields.maintenance_message.label"),
                  multiline: true,
                  required: false,
                  maxLength: 500,
                },
              ]}
              values={{
                maintenance_message_en: String(draft.maintenance_message_en ?? ""),
                maintenance_message_ar: String(draft.maintenance_message_ar ?? ""),
              }}
              errors={errors}
              onChange={(key, v) => set(key, v)}
            />
          }
        />
      )}
    </>
  );
}

/** Terms of Use and Privacy Policy, EN / AR, shown on the public pages the stores and the app link to. */
function LegalRows({
  draft,
  set,
  errors,
}: {
  draft: Draft;
  set: (key: string, v: SettingValue) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const docs = [
    { name: "legal_terms", page: "terms" },
    { name: "legal_privacy", page: "privacy" },
  ] as const;
  return (
    <>
      {docs.map(({ name, page }) => (
        <Row
          key={name}
          stacked
          label={t(`fields.${name}.label`)}
          hint={
            <>
              {t("fields.legal.hint")}{" "}
              <a
                href={`/${locale}/legal/${page}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand hover:underline"
              >
                {t("fields.legal.open")}
              </a>
            </>
          }
          control={
            <BilingualFields
              fields={[{ name, label: t(`fields.${name}.label`), multiline: true, required: true, maxLength: 60_000, rows: 18 }]}
              values={{
                [`${name}_en`]: String(draft[`${name}_en`] ?? ""),
                [`${name}_ar`]: String(draft[`${name}_ar`] ?? ""),
              }}
              errors={errors}
              onChange={(key, v) => set(key, v)}
            />
          }
        />
      ))}
    </>
  );
}
