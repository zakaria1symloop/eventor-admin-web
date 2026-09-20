"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/forms/fields";
import { EmailInput, PasswordInput } from "@/components/forms/inputs";
import { Banner } from "@/components/feedback/banner";
import { CardSkeleton, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import {
  authKeys,
  changePassword,
  getSessions,
  isStrongPassword,
  revokeSession,
  updateMe,
  type AdminLanguage,
  type AdminMe,
  type AdminSession,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/auth/form-errors";
import { useSession, useSignOut } from "@/lib/auth/use-session";
import { formatRelative, initials } from "@/lib/utils/format";

export function AccountScreen() {
  const session = useSession();
  if (session.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton className="h-72" />
        <CardSkeleton className="h-72" />
      </div>
    );
  }
  if (session.isError) {
    return (
      <Card>
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </Card>
    );
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <ProfileCard me={session.data} />
      <div className="flex flex-col gap-4">
        <PasswordCard />
        <SessionsCard />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Profile */

type ProfileValues = { fullName: string; email: string; language: AdminLanguage; currentPassword: string };

function ProfileCard({ me }: { me: AdminMe }) {
  const t = useTranslations("myAccount");
  const tv = useTranslations("validation");
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z
    .object({
      fullName: z.string().trim().min(2, tv("required")).max(120),
      email: z.string().trim().min(1, tv("required")).email(tv("email")),
      language: z.enum(["en", "ar"]),
      currentPassword: z.string(),
    })
    .refine((v) => v.email.toLowerCase() === me.email.toLowerCase() || v.currentPassword.length > 0, {
      path: ["currentPassword"],
      message: t("emailNeedsPassword"),
    });

  const defaults: ProfileValues = {
    fullName: me.fullName,
    email: me.email,
    language: me.language,
    currentPassword: "",
  };
  const form = useForm<ProfileValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const [watchedEmail, watchedName] = useWatch({ control: form.control, name: ["email", "fullName"] });
  const emailChanged = watchedEmail.trim().toLowerCase() !== me.email.toLowerCase();
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const updated = await updateMe({
        fullName: v.fullName.trim(),
        email: emailChanged ? v.email.trim() : undefined,
        language: v.language,
        currentPassword: emailChanged ? v.currentPassword : undefined,
      });
      queryClient.setQueryData(authKeys.me(), updated);
      form.reset({
        fullName: updated.fullName,
        email: updated.email,
        language: updated.language,
        currentPassword: "",
      });
      toast.success(t("profileSaved"));
      if (updated.language !== locale) {
        router.replace(pathname, { locale: updated.language });
      }
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["fullName", "email", "language", "currentPassword"])) return;
      if (e instanceof ApiError && e.code === "EMAIL_TAKEN")
        form.setError("email", { type: "server", message: e.message });
      else if (e instanceof ApiError && e.code === "CURRENT_PASSWORD_INVALID")
        form.setError("currentPassword", { type: "server", message: e.message });
      else setFormError(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <Card>
      <CardHeader title={t("profile")} className="border-b-0 pb-2" />
      <CardBody className="pt-0">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && <Banner tone="red" title={formError} />}
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-18 font-semibold text-brand">
            {initials(watchedName || me.fullName)}
          </span>
          <Field label={t("fullName")} error={errors.fullName?.message}>
            <TextInput autoComplete="name" {...form.register("fullName")} />
          </Field>
          <Field label={t("email")} hint={t("emailHint")} error={errors.email?.message}>
            <EmailInput {...form.register("email")} />
          </Field>
          {emailChanged && (
            <Field label={t("currentPassword")} error={errors.currentPassword?.message}>
              <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
            </Field>
          )}
          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <Field label={t("language")}>
                <Select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  options={[
                    { value: "en", label: "English" },
                    { value: "ar", label: "العربية" },
                  ]}
                />
              </Field>
            )}
          />
          <div>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              {t("saveProfile")}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ Password */

type PasswordValues = { currentPassword: string; newPassword: string; confirm: string };

function PasswordCard() {
  const t = useTranslations("myAccount");
  const tv = useTranslations("validation");
  const queryClient = useQueryClient();
  const schema = z
    .object({
      currentPassword: z.string().min(1, tv("required")),
      newPassword: z.string().min(1, tv("required")).refine(isStrongPassword, tv("passwordWeak")),
      confirm: z.string().min(1, tv("required")),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: tv("passwordMismatch") });
  const form = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await changePassword(v.currentPassword, v.newPassword);
      form.reset();
      toast.success(t("passwordUpdated"), { description: t("otherSessionsSignedOut") });
      void queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["currentPassword", "newPassword"])) return;
      if (e instanceof ApiError && e.code === "CURRENT_PASSWORD_INVALID")
        form.setError("currentPassword", { type: "server", message: e.message });
      else if (e instanceof ApiError && e.code === "PASSWORD_WEAK")
        form.setError("newPassword", { type: "server", message: e.message });
      else toast.apiError(e);
    }
  });

  return (
    <Card>
      <CardHeader title={t("password")} className="border-b-0 pb-2" />
      <CardBody className="pt-0">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label={t("currentPassword")} error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("newPassword")} hint={t("passwordRule")} error={errors.newPassword?.message}>
              <PasswordInput autoComplete="new-password" {...form.register("newPassword")} />
            </Field>
            <Field label={t("confirm")} error={errors.confirm?.message}>
              <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
            </Field>
          </div>
          <div>
            <Button type="submit" variant="secondary" loading={isSubmitting}>
              {t("updatePassword")}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ Sessions */

function sessionTitle(s: AdminSession, fallback: string) {
  if (s.deviceLabel) return s.deviceLabel;
  const ua = s.userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return [browser, os].filter(Boolean).join(" · ") || fallback;
}

function SessionsCard() {
  const t = useTranslations("myAccount");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const sessions = useQuery({ queryKey: authKeys.sessions(), queryFn: getSessions });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success(t("sessionSignedOut"));
      void queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
    onError: (e) => toast.apiError(e),
  });

  return (
    <Card>
      <CardHeader title={t("sessions")} className="border-b-0 pb-2" />
      <CardBody className="pt-0">
        {sessions.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <div className="h-9 animate-pulse rounded-md bg-gray-soft" />
            <div className="h-9 animate-pulse rounded-md bg-gray-soft" />
          </div>
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} className="py-6" />
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-13 font-medium text-ink">
                    {sessionTitle(s, t("unknownDevice"))}
                  </div>
                  <div className="truncate text-12 text-muted">
                    {[s.ip, s.current ? t("now") : s.lastUsedAt ? formatRelative(s.lastUsedAt, locale) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {s.current ? (
                  <Pill tone="green">{t("thisDevice")}</Pill>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={revoke.isPending && revoke.variables === s.id}
                    onClick={() => revoke.mutate(s.id)}
                  >
                    {t("signOutSession")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="secondary"
          icon={<LogOut className="flip-rtl" />}
          className="mt-4"
          loading={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          {t("signOut")}
        </Button>
      </CardBody>
    </Card>
  );
}
