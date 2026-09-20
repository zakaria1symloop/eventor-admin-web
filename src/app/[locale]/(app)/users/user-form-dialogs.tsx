"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { FormDialog, FormDrawer } from "@/components/feedback/form-dialog";
import { toast } from "@/components/feedback/toast";
import { Field, Select, TextInput, Textarea, Toggle } from "@/components/forms/fields";
import { EmailInput, PhoneInput, SegmentedControl } from "@/components/forms/inputs";
import { MultiSelect } from "@/components/forms/select-inputs";
import { ApiError } from "@/lib/api/errors";
import {
  createUser,
  updateUser,
  type CreateUserBody,
  type UpdateUserBody,
  type UserDetail,
} from "@/lib/api/users";
import { normalizeDzPhone } from "@/lib/utils/format";
import { useUserOptions } from "./use-user-options";

const FIELD_ERRORS: Record<string, string> = { EMAIL_TAKEN: "email", PHONE_TAKEN: "phone" };

/** EMAIL_TAKEN / PHONE_TAKEN → field errors (FormDialog maps VALIDATION_FAILED details onto fields). */
function mapContactErrors(e: unknown, messages: Record<string, string>): never {
  if (e instanceof ApiError && FIELD_ERRORS[e.code]) {
    throw new ApiError({
      status: e.status,
      code: "VALIDATION_FAILED",
      message: e.message,
      details: [{ field: FIELD_ERRORS[e.code], code: e.code, message: messages[e.code] ?? e.message }],
    });
  }
  if (e instanceof ApiError && e.fieldErrors.length > 0) {
    throw new ApiError({
      status: e.status,
      code: e.code,
      message: e.message,
      details: e.fieldErrors.map((f) => ({ ...f, field: f.field === "wilayaCodes" ? "wilayas" : f.field })),
    });
  }
  throw e;
}

function useSchemas() {
  const tv = useTranslations("users.form");
  const phone = z
    .string()
    .trim()
    .refine((v) => normalizeDzPhone(v) !== null, { message: tv("phoneInvalid") });
  const base = {
    fullName: z.string().trim().min(2, tv("nameRequired")).max(120),
    email: z.email(tv("emailInvalid")).max(190),
    language: z.enum(["ar", "en"]),
    businessName: z.string().trim().max(150),
    categoryId: z.string(),
    wilayas: z.array(z.string()),
  };
  return { tv, phone, base };
}

/* ------------------------------------------------------------------ USR-05 add user */

export function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (user: UserDetail) => void;
}) {
  const t = useTranslations("users.add");
  const { tv, phone, base } = useSchemas();
  const { categoryOptions, wilayaOptions } = useUserOptions();

  const schema = z
    .object({
      role: z.enum(["client", "provider"]),
      ...base,
      phone,
      skipVerification: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.role !== "provider") return;
      if (v.businessName.trim().length < 2)
        ctx.addIssue({ code: "custom", path: ["businessName"], message: tv("businessRequired") });
      if (!v.categoryId)
        ctx.addIssue({ code: "custom", path: ["categoryId"], message: tv("categoryRequired") });
    });
  type Values = z.input<typeof schema>;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      width={600}
      schema={schema}
      defaultValues={{
        role: "client",
        fullName: "",
        email: "",
        phone: "",
        language: "ar",
        businessName: "",
        categoryId: "",
        wilayas: [],
        skipVerification: false,
      }}
      submitLabel={t("submit")}
      footerNote={t("roleImmutable")}
      fields={(form) => (
        <AddUserFields
          form={form as UseFormReturn<Values>}
          categoryOptions={categoryOptions}
          wilayaOptions={wilayaOptions}
        />
      )}
      onSubmit={async (v) => {
        const provider = v.role === "provider";
        const codes = v.wilayas.map(Number);
        const body: CreateUserBody = {
          role: v.role,
          fullName: v.fullName,
          email: v.email,
          phone: normalizeDzPhone(v.phone) ?? v.phone,
          language: v.language,
          ...(provider
            ? {
                businessName: v.businessName,
                categoryId: v.categoryId,
                wilayaCodes: codes.length ? codes : undefined,
                wilayaCode: codes[0],
                skipVerification: v.skipVerification,
              }
            : { wilayaCode: codes[0] }),
        };
        try {
          const user = await createUser(body);
          toast.success(t("created", { name: user.fullName }));
          onCreated?.(user);
        } catch (e) {
          mapContactErrors(e, { EMAIL_TAKEN: tv("emailTaken"), PHONE_TAKEN: tv("phoneTaken") });
        }
      }}
    />
  );
}

type AddValues = {
  role: "client" | "provider";
  fullName: string;
  email: string;
  phone: string;
  language: "ar" | "en";
  businessName: string;
  categoryId: string;
  wilayas: string[];
  skipVerification: boolean;
};

function AddUserFields({
  form,
  categoryOptions,
  wilayaOptions,
}: {
  form: UseFormReturn<AddValues>;
  categoryOptions: { value: string; label: string }[];
  wilayaOptions: { value: string; label: string }[];
}) {
  const t = useTranslations("users.add");
  const tf = useTranslations("users.form");
  const tr = useTranslations("status.role");
  const role = form.watch("role");
  const provider = role === "provider";
  const c = form.control;
  return (
    <>
      <Controller
        control={c}
        name="role"
        render={({ field }) => (
          <SegmentedControl
            aria-label={t("role")}
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v);
              form.setValue("wilayas", form.getValues("wilayas").slice(0, v === "client" ? 1 : 58));
            }}
            options={[
              { value: "client", label: tr("client") },
              { value: "provider", label: tr("provider") },
            ]}
            className="h-10"
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={c}
          name="fullName"
          render={({ field, fieldState }) => (
            <Field label={tf("fullName")} required error={fieldState.error?.message}>
              <TextInput {...field} autoComplete="off" />
            </Field>
          )}
        />
        <Controller
          control={c}
          name="phone"
          render={({ field, fieldState }) => (
            <Field label={tf("phone")} required error={fieldState.error?.message}>
              <PhoneInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
            </Field>
          )}
        />
        <Controller
          control={c}
          name="email"
          render={({ field, fieldState }) => (
            <Field label={tf("email")} required error={fieldState.error?.message}>
              <EmailInput {...field} autoComplete="off" />
            </Field>
          )}
        />
        <Controller
          control={c}
          name="language"
          render={({ field }) => (
            <Field label={tf("language")}>
              <Select
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "ar", label: tf("languages.ar") },
                  { value: "en", label: tf("languages.en") },
                ]}
              />
            </Field>
          )}
        />
        {provider && (
          <>
            <Controller
              control={c}
              name="businessName"
              render={({ field, fieldState }) => (
                <Field
                  label={tf("businessName")}
                  required
                  error={fieldState.error?.message}
                  hint={t("providersOnly")}
                >
                  <TextInput {...field} />
                </Field>
              )}
            />
            <Controller
              control={c}
              name="categoryId"
              render={({ field, fieldState }) => (
                <Field label={tf("category")} required error={fieldState.error?.message}>
                  <Select
                    value={field.value}
                    onChange={field.onChange}
                    options={categoryOptions}
                    placeholder={tf("pickCategory")}
                  />
                </Field>
              )}
            />
          </>
        )}
      </div>
      <Controller
        control={c}
        name="wilayas"
        render={({ field, fieldState }) =>
          provider ? (
            <Field label={tf("wilayasServed")} hint={t("wilayasHint")} error={fieldState.error?.message}>
              <MultiSelect
                value={field.value}
                onValueChange={field.onChange}
                options={wilayaOptions}
                placeholder={tf("pickWilayas")}
              />
            </Field>
          ) : (
            <Field label={tf("wilaya")} hint={t("wilayasHint")} error={fieldState.error?.message}>
              <Select
                value={field.value[0] ?? ""}
                onChange={(e) => field.onChange(e.target.value ? [e.target.value] : [])}
                options={wilayaOptions}
                placeholder={tf("pickWilaya")}
              />
            </Field>
          )
        }
      />
      {provider && (
        <Controller
          control={c}
          name="skipVerification"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
              <div>
                <div className="text-13 font-medium text-ink">{t("skipVerification")}</div>
                <div className="text-12 text-muted">{t("skipVerificationHint")}</div>
              </div>
              <Toggle
                aria-label={t("skipVerification")}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ USR-06 edit details */

export function EditUserDrawer({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: UserDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (user: UserDetail) => void;
}) {
  const t = useTranslations("users.edit");
  const tr = useTranslations("status.role");
  const { tv, base } = useSchemas();
  const { categoryOptions, wilayaOptions } = useUserOptions();
  if (!user) return null;
  const provider = user.role === "provider";
  const originalPhone = user.phone ?? "";
  const originalWilayas = provider
    ? (user.provider?.wilayas ?? []).map((w) => String(w.code))
    : user.wilaya
      ? [String(user.wilaya.code)]
      : [];

  const schema = z
    .object({
      ...base,
      phone: z.string().trim(),
      reason: z.string().max(500),
    })
    .superRefine((v, ctx) => {
      if (v.phone && normalizeDzPhone(v.phone) === null)
        ctx.addIssue({ code: "custom", path: ["phone"], message: tv("phoneInvalid") });
      const contactChanged =
        v.email.trim().toLowerCase() !== user.email.toLowerCase() ||
        (normalizeDzPhone(v.phone) ?? v.phone) !== originalPhone;
      if (contactChanged && !v.reason.trim())
        ctx.addIssue({ code: "custom", path: ["reason"], message: t("reasonRequired") });
      if (provider && v.businessName.trim().length < 2)
        ctx.addIssue({ code: "custom", path: ["businessName"], message: tv("businessRequired") });
    });

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={`${user.fullName} · ${tr(user.role)}`}
      width={500}
      schema={schema}
      defaultValues={{
        fullName: user.fullName,
        email: user.email,
        phone: originalPhone,
        language: user.language,
        businessName: user.provider?.businessName ?? user.businessName ?? "",
        categoryId: user.provider?.category?.id ?? user.category?.id ?? "",
        wilayas: originalWilayas,
        reason: "",
      }}
      submitLabel={t("submit")}
      fields={(form) => (
        <EditFields
          form={form as never}
          provider={provider}
          email={user.email}
          phone={originalPhone}
          categoryOptions={categoryOptions}
          wilayaOptions={wilayaOptions}
        />
      )}
      onSubmit={async (v) => {
        const body: UpdateUserBody = {};
        const phone = v.phone ? (normalizeDzPhone(v.phone) ?? v.phone) : null;
        if (v.fullName !== user.fullName) body.fullName = v.fullName;
        if (v.email.toLowerCase() !== user.email.toLowerCase()) body.email = v.email;
        if ((phone ?? "") !== originalPhone) body.phone = phone;
        if (v.language !== user.language) body.language = v.language;
        const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
        if (!same(v.wilayas, originalWilayas)) {
          if (provider) body.wilayaCodes = v.wilayas.map(Number);
          else body.wilayaCode = v.wilayas[0] ? Number(v.wilayas[0]) : null;
        }
        if (provider) {
          if (v.businessName !== (user.provider?.businessName ?? user.businessName ?? ""))
            body.businessName = v.businessName;
          if (v.categoryId && v.categoryId !== (user.provider?.category?.id ?? user.category?.id))
            body.categoryId = v.categoryId;
        }
        if (body.email !== undefined || body.phone !== undefined) body.reason = v.reason.trim();
        if (Object.keys(body).length === 0) return;
        try {
          const saved = await updateUser(user.id, body);
          toast.success(t("saved", { name: saved.fullName }));
          onSaved?.(saved);
        } catch (e) {
          mapContactErrors(e, { EMAIL_TAKEN: tv("emailTaken"), PHONE_TAKEN: tv("phoneTaken") });
        }
      }}
    />
  );
}

type EditValues = {
  fullName: string;
  email: string;
  phone: string;
  language: "ar" | "en";
  businessName: string;
  categoryId: string;
  wilayas: string[];
  reason: string;
};

function EditFields({
  form,
  provider,
  email,
  phone,
  categoryOptions,
  wilayaOptions,
}: {
  form: UseFormReturn<EditValues>;
  provider: boolean;
  email: string;
  phone: string;
  categoryOptions: { value: string; label: string }[];
  wilayaOptions: { value: string; label: string }[];
}) {
  const t = useTranslations("users.edit");
  const tf = useTranslations("users.form");
  const c = form.control;
  const emailNow = form.watch("email");
  const phoneNow = form.watch("phone");
  const emailChanged = emailNow.trim().toLowerCase() !== email.toLowerCase();
  const phoneChanged = (normalizeDzPhone(phoneNow) ?? phoneNow) !== phone;
  return (
    <>
      <Controller
        control={c}
        name="fullName"
        render={({ field, fieldState }) => (
          <Field label={tf("fullName")} required error={fieldState.error?.message}>
            <TextInput {...field} />
          </Field>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={c}
          name="email"
          render={({ field, fieldState }) => (
            <Field label={tf("email")} required error={fieldState.error?.message}>
              <EmailInput {...field} />
            </Field>
          )}
        />
        <Controller
          control={c}
          name="phone"
          render={({ field, fieldState }) => (
            <Field label={tf("phone")} error={fieldState.error?.message}>
              <PhoneInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
            </Field>
          )}
        />
      </div>
      {provider && (
        <Controller
          control={c}
          name="businessName"
          render={({ field, fieldState }) => (
            <Field label={tf("businessName")} required error={fieldState.error?.message}>
              <TextInput {...field} />
            </Field>
          )}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {provider && (
          <Controller
            control={c}
            name="categoryId"
            render={({ field }) => (
              <Field label={tf("category")}>
                <Select value={field.value} onChange={field.onChange} options={categoryOptions} />
              </Field>
            )}
          />
        )}
        <Controller
          control={c}
          name="language"
          render={({ field }) => (
            <Field label={tf("language")}>
              <Select
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "ar", label: tf("languages.ar") },
                  { value: "en", label: tf("languages.en") },
                ]}
              />
            </Field>
          )}
        />
      </div>
      <Controller
        control={c}
        name="wilayas"
        render={({ field }) =>
          provider ? (
            <Field label={tf("wilayasServed")}>
              <MultiSelect value={field.value} onValueChange={field.onChange} options={wilayaOptions} />
            </Field>
          ) : (
            <Field label={tf("wilaya")}>
              <Select
                value={field.value[0] ?? ""}
                onChange={(e) => field.onChange(e.target.value ? [e.target.value] : [])}
                options={wilayaOptions}
                placeholder={tf("pickWilaya")}
              />
            </Field>
          )
        }
      />
      {(emailChanged || phoneChanged) && (
        <Controller
          control={c}
          name="reason"
          render={({ field, fieldState }) => (
            <Field
              label={emailChanged ? t("emailChanged") : t("phoneChanged")}
              required
              hint={t("reasonHint")}
              error={fieldState.error?.message}
            >
              <Textarea {...field} placeholder={t("reasonPlaceholder")} />
            </Field>
          )}
        />
      )}
    </>
  );
}
