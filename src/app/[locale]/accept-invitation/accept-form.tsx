"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/forms/fields";
import { PasswordInput } from "@/components/forms/inputs";
import { Banner } from "@/components/feedback/banner";
import { ErrorState } from "@/components/feedback/states";
import { acceptInvitation, authKeys, getInvitation } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { applyApiFieldErrors, isNetworkError } from "@/lib/auth/form-errors";
import { newPasswordSchema } from "@/lib/auth/password-schema";

const INVALID_CODES = ["INVITATION_INVALID", "INVITATION_EXPIRED"];

/** GET /admin/auth/invitations/:token → set a password → POST …/accept (signed in). */
export function AcceptInvitationForm({ token }: { token: string }) {
  const t = useTranslations("invitation");
  const hydrated = useHydrated();
  const tv = useTranslations("validation");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const invitation = useQuery({
    queryKey: authKeys.invitation(token),
    queryFn: () => getInvitation(token),
    enabled: !!token,
    retry: false,
  });

  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(newPasswordSchema(tv)),
    defaultValues: { password: "", confirm: "" },
  });

  const invalid = (code: string) => (
    <Banner
      tone="red"
      title={code === "INVITATION_EXPIRED" ? t("expiredTitle") : t("invalidTitle")}
      description={t("invalidDescription")}
      action={
        <Link href="/login" className="text-13 font-medium text-brand hover:underline">
          {t("goToSignIn")}
        </Link>
      }
    />
  );

  if (!token) return invalid("INVITATION_INVALID");
  if (invitation.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <div className="h-9 animate-pulse rounded-md bg-gray-soft" />
        <div className="h-9 animate-pulse rounded-md bg-gray-soft" />
        <div className="h-9 animate-pulse rounded-md bg-gray-soft" />
      </div>
    );
  }
  if (invitation.isError) {
    const e = invitation.error;
    if (e instanceof ApiError && INVALID_CODES.includes(e.code)) return invalid(e.code);
    return <ErrorState error={e} onRetry={() => void invitation.refetch()} className="py-6" />;
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      const result = await acceptInvitation(token, password);
      queryClient.setQueryData(authKeys.me(), result.user);
      router.replace("/");
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["password"])) return;
      if (e instanceof ApiError && e.code === "PASSWORD_WEAK") {
        form.setError("password", { type: "server", message: e.message || tv("passwordWeak") });
      } else if (e instanceof ApiError && INVALID_CODES.includes(e.code)) {
        void invitation.refetch();
      } else {
        setFormError(isNetworkError(e) ? t("network") : e instanceof Error ? e.message : String(e));
      }
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError && <Banner tone="red" title={formError} />}
      <Field label={t("fullName")}>
        <TextInput value={invitation.data.fullName} readOnly disabled />
      </Field>
      <Field label={t("email")}>
        <TextInput value={invitation.data.email} readOnly disabled dir="ltr" />
      </Field>
      <Field label={t("password")} hint={t("rule")} error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label={t("confirm")} error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" className="w-full" loading={isSubmitting} disabled={!hydrated}>
        {t("submit")}
      </Button>
    </form>
  );
}
