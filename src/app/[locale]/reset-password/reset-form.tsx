"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/fields";
import { PasswordInput } from "@/components/forms/inputs";
import { Banner } from "@/components/feedback/banner";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { applyApiFieldErrors, isNetworkError } from "@/lib/auth/form-errors";
import { newPasswordSchema } from "@/lib/auth/password-schema";

/** SHL-04 email link: POST /admin/auth/reset → /login?reset=1 ("Password changed" toast). */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("reset");
  const hydrated = useHydrated();
  const tv = useTranslations("validation");
  const router = useRouter();
  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(newPasswordSchema(tv)),
    defaultValues: { password: "", confirm: "" },
  });
  const [error, setError] = useState<"invalid" | string | null>(token ? null : "invalid");

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await resetPassword(token, password);
      router.replace("/login?reset=1");
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["password"])) return;
      if (e instanceof ApiError && e.code === "PASSWORD_WEAK") {
        form.setError("password", { type: "server", message: e.message || tv("passwordWeak") });
      } else if (
        e instanceof ApiError &&
        (e.code === "RESET_TOKEN_INVALID" || e.code === "RESET_TOKEN_EXPIRED")
      ) {
        setError("invalid");
      } else {
        setError(isNetworkError(e) ? t("network") : e instanceof Error ? e.message : String(e));
      }
    }
  });

  if (error === "invalid") {
    return (
      <Banner
        tone="red"
        title={t("invalidTitle")}
        description={t("invalidDescription")}
        action={
          <Link href="/forgot-password" className="text-13 font-medium text-brand hover:underline">
            {t("requestNew")}
          </Link>
        }
      />
    );
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {error && <Banner tone="red" title={error} />}
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
