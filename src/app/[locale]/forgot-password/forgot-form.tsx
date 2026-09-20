"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/fields";
import { EmailInput } from "@/components/forms/inputs";
import { Banner } from "@/components/feedback/banner";
import { forgotPassword } from "@/lib/api/auth";
import { applyApiFieldErrors, isNetworkError } from "@/lib/auth/form-errors";

/** SHL-04: POST /admin/auth/forgot — always a neutral success message. */
export function ForgotPasswordForm() {
  const t = useTranslations("forgot");
  const hydrated = useHydrated();
  const tv = useTranslations("validation");
  const schema = z.object({ email: z.string().trim().min(1, tv("required")).email(tv("email")) });
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const [state, setState] = useState<"idle" | "sent" | "network">("idle");

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setState("idle");
    try {
      await forgotPassword(email.trim());
      setState("sent");
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["email"])) return;
      // Don't reveal whether the email exists: any API answer is a neutral success.
      setState(isNetworkError(e) ? "network" : "sent");
    }
  });

  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <Field label={t("email")} error={form.formState.errors.email?.message}>
        <EmailInput autoComplete="email" {...form.register("email")} />
      </Field>
      {state === "sent" && <Banner tone="green" title={t("sent")} />}
      {state === "network" && <Banner tone="red" title={t("network")} />}
      <Button type="submit" className="w-full" loading={form.formState.isSubmitting} disabled={!hydrated}>
        {t("submit")}
      </Button>
    </form>
  );
}
