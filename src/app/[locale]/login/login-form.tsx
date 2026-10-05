"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { z } from "zod";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field } from "@/components/forms/fields";
import { EmailInput, PasswordInput } from "@/components/forms/inputs";
import { Banner } from "@/components/feedback/banner";
import { toast } from "@/components/feedback/toast";
import { authKeys, login, safeNextPath } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { applyApiFieldErrors, isNetworkError } from "@/lib/auth/form-errors";
import { formatCountdown } from "@/lib/utils/format";

/** Wall clock, outside render (lockout countdown). */
const clockNow = () => Date.now();

type Values = { email: string; password: string; remember: boolean };

type FormBanner =
  { kind: "locked" } | { kind: "blocked" | "forbidden" | "network" | "other"; message: string };

/** SHL-03 sign-in form: POST /admin/auth/login. */
export function LoginForm({
  next,
  passwordChanged,
  signedInElsewhere,
}: {
  next?: string;
  passwordChanged?: boolean;
  /** `?reason=replaced`: this admin signed in on another computer, which ended this session. */
  signedInElsewhere?: boolean;
}) {
  const t = useTranslations("login");
  const hydrated = useHydrated();
  const tv = useTranslations("validation");
  const router = useRouter();
  const queryClient = useQueryClient();

  const schema = z.object({
    email: z.string().trim().min(1, tv("required")).email(tv("email")),
    password: z.string().min(1, tv("required")),
    remember: z.boolean(),
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });
  const { errors, isSubmitting } = form.formState;
  const remember = useWatch({ control: form.control, name: "remember" });

  const [banner, setBanner] = useState<FormBanner | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => {
      const n = clockNow();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        setBanner(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const toasted = useRef(false);
  useEffect(() => {
    if (passwordChanged && !toasted.current) {
      toasted.current = true;
      toast.success(t("passwordChanged"));
    }
  }, [passwordChanged, t]);

  const remaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const locked = lockedUntil !== null && remaining > 0;

  const onSubmit = form.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const result = await login({
        email: values.email.trim(),
        password: values.password,
        remember: values.remember,
      });
      queryClient.setQueryData(authKeys.me(), result.user);
      router.replace(safeNextPath(next));
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["email", "password"])) return;
      if (!(e instanceof ApiError)) {
        setBanner({ kind: "other", message: e instanceof Error ? e.message : String(e) });
        return;
      }
      switch (e.code) {
        case "INVALID_CREDENTIALS":
          form.setError("password", { type: "server", message: e.message || t("invalidCredentials") });
          break;
        case "ACCOUNT_LOCKED": {
          const d = (e.details ?? {}) as { retryAfterSeconds?: number };
          const seconds = typeof d.retryAfterSeconds === "number" ? d.retryAfterSeconds : 15 * 60;
          const start = clockNow();
          setNow(start);
          setLockedUntil(start + seconds * 1000);
          setBanner({ kind: "locked" });
          break;
        }
        case "ACCOUNT_BLOCKED":
          setBanner({ kind: "blocked", message: t("blocked") });
          break;
        case "FORBIDDEN_ROLE":
          setBanner({ kind: "forbidden", message: t("forbiddenRole") });
          break;
        default:
          setBanner({
            kind: isNetworkError(e) ? "network" : "other",
            message: isNetworkError(e) ? t("network") : e.message,
          });
      }
    }
  });

  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {banner?.kind === "locked" && locked && (
        <Banner
          tone="amber"
          title={t("lockedTitle")}
          description={t("lockedDescription", { time: formatCountdown(remaining) })}
        />
      )}
      {banner && banner.kind !== "locked" && <Banner tone="red" title={banner.message} />}
      {!banner && signedInElsewhere && (
        <Banner tone="amber" title={t("signedInElsewhereTitle")} description={t("signedInElsewhere")} />
      )}

      <Field label={t("email")} error={errors.email?.message}>
        <EmailInput autoComplete="username" placeholder="name@eventor.dz" {...form.register("email")} />
      </Field>
      <Field label={t("password")} error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" {...form.register("password")} />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Checkbox
          label={t("remember")}
          checked={remember}
          onCheckedChange={(v) => form.setValue("remember", v)}
        />
        <Link
          href="/forgot-password"
          className="text-13 font-medium whitespace-nowrap text-brand hover:underline"
        >
          {t("forgot")}
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting} disabled={!hydrated || locked}>
        {locked ? t("lockedButton", { time: formatCountdown(remaining) }) : t("submit")}
      </Button>
    </form>
  );
}
