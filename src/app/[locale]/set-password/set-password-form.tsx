"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/feedback/banner";
import { Field } from "@/components/forms/fields";
import { PasswordInput } from "@/components/forms/inputs";
import {
  APP_PASSWORD_MAX,
  APP_PASSWORD_MIN,
  appAuthKeys,
  checkSetPasswordLink,
  getStoreUrls,
  setAppPassword,
} from "@/lib/api/app-auth";
import { ApiError } from "@/lib/api/errors";
import { applyApiFieldErrors, isNetworkError } from "@/lib/auth/form-errors";
import { newPasswordSchema } from "@/lib/auth/password-schema";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { cn } from "@/lib/utils/cn";

/** Why the link can't be used. */
type LinkProblem =
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "blocked"; reason: string | null; message: string | null }
  | { kind: "rateLimited" }
  | { kind: "network" };

/** Maps an API error of `…/set-password[/check]` to a link problem, or null when it is something else. */
export function linkProblem(error: unknown): LinkProblem | null {
  if (isNetworkError(error)) return { kind: "network" };
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case "RESET_TOKEN_INVALID":
    case "ROLE_NOT_ALLOWED_IN_APP": // an admin account: this page is for app accounts only
    case "VALIDATION_FAILED": // a malformed or truncated token
      return { kind: "invalid" };
    case "RESET_TOKEN_EXPIRED":
      return { kind: "expired" };
    case "ACCOUNT_BLOCKED": {
      const d = (error.details ?? {}) as { reasonLabel?: unknown; message?: unknown };
      return {
        kind: "blocked",
        reason: typeof d.reasonLabel === "string" && d.reasonLabel ? d.reasonLabel : null,
        message: typeof d.message === "string" && d.message ? d.message : null,
      };
    }
    case "RATE_LIMITED":
      return { kind: "rateLimited" };
    default:
      return null;
  }
}

/** Keeps an e-mail address left-to-right inside Arabic text: LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL ISOLATE. */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);
const ltr = (s: string) => `${LRI}${s}${PDI}`;

const passwordRules = (value: string) => [
  { key: "ruleLength", ok: value.length >= APP_PASSWORD_MIN && value.length <= APP_PASSWORD_MAX },
  { key: "ruleLetter", ok: /[A-Za-z]/.test(value) },
  { key: "ruleDigit", ok: /\d/.test(value) },
];

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("setPassword");
  const [done, setDone] = useState<{ email: string } | null>(null);
  const [problem, setProblem] = useState<LinkProblem | null>(token ? null : { kind: "invalid" });

  const link = useQuery({
    queryKey: appAuthKeys.setPasswordLink(token),
    queryFn: () => checkSetPasswordLink(token),
    enabled: !!token && !done && !problem,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  if (done) return <Done email={done.email} />;
  const shown = problem ?? (link.error ? (linkProblem(link.error) ?? { kind: "network" }) : null);
  if (shown)
    return (
      <Problem
        problem={shown}
        onRetry={
          shown.kind === "network" || shown.kind === "rateLimited"
            ? () => {
                setProblem(null);
                void link.refetch();
              }
            : undefined
        }
      />
    );
  if (!link.data) {
    return (
      <p role="status" className="flex items-center gap-2 text-13 text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("checking")}
      </p>
    );
  }
  return (
    <PasswordForm
      token={token}
      firstName={link.data.firstName}
      emailHint={link.data.emailHint}
      onDone={setDone}
      onProblem={setProblem}
    />
  );
}

function PasswordForm({
  token,
  firstName,
  emailHint,
  onDone,
  onProblem,
}: {
  token: string;
  firstName: string;
  emailHint: string;
  onDone: (v: { email: string }) => void;
  onProblem: (p: LinkProblem) => void;
}) {
  const t = useTranslations("setPassword");
  const tv = useTranslations("validation");
  const hydrated = useHydrated();
  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(newPasswordSchema(tv, { max: APP_PASSWORD_MAX })),
    defaultValues: { password: "", confirm: "" },
  });
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const [error, setError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async ({ password: value }) => {
    setError(null);
    try {
      onDone(await setAppPassword(token, value));
    } catch (e) {
      if (applyApiFieldErrors(e, form.setError, ["password"])) return;
      if (e instanceof ApiError && e.code === "PASSWORD_WEAK") {
        form.setError("password", { type: "server", message: tv("passwordWeak") });
        return;
      }
      const p = linkProblem(e);
      if (p && p.kind !== "network" && p.kind !== "rateLimited") return onProblem(p);
      setError(
        p?.kind === "rateLimited"
          ? t("rateLimited")
          : p?.kind === "network"
            ? t("network")
            : e instanceof Error
              ? e.message
              : String(e),
      );
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <form method="post" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <p className="text-14 text-ink-2">{t("hello", { firstName, emailHint: ltr(emailHint) })}</p>
      {error && <Banner tone="red" title={error} />}
      <Field label={t("password")} error={errors.password?.message}>
        <PasswordInput
          autoComplete="new-password"
          maxLength={APP_PASSWORD_MAX}
          aria-describedby="set-password-rules"
          {...form.register("password")}
        />
      </Field>
      <ul id="set-password-rules" aria-label={t("rulesTitle")} className="flex flex-col gap-1 text-12">
        {passwordRules(password).map((r) => (
          <li key={r.key} className={cn("flex items-center gap-1.5", r.ok ? "text-green" : "text-muted")}>
            {r.ok ? (
              <CheckCircle2 className="size-3.5" aria-hidden />
            ) : (
              <Circle className="size-3.5" aria-hidden />
            )}
            <span>{t(r.key, { min: APP_PASSWORD_MIN, max: APP_PASSWORD_MAX })}</span>
            <span className="sr-only">{r.ok ? t("ruleMet") : t("ruleNotMet")}</span>
          </li>
        ))}
      </ul>
      <Field label={t("confirm")} error={errors.confirm?.message}>
        <PasswordInput
          autoComplete="new-password"
          maxLength={APP_PASSWORD_MAX}
          {...form.register("confirm")}
        />
      </Field>
      <Button type="submit" className="w-full" loading={isSubmitting} disabled={!hydrated}>
        {t("submit")}
      </Button>
    </form>
  );
}

function Problem({ problem, onRetry }: { problem: LinkProblem; onRetry?: () => void }) {
  const t = useTranslations("setPassword");
  const retry = onRetry && (
    <Button size="sm" variant="secondary" onClick={onRetry}>
      {t("retry")}
    </Button>
  );
  switch (problem.kind) {
    case "invalid":
      return <Banner tone="red" title={t("invalidTitle")} description={t("invalidDescription")} />;
    case "expired":
      return <Banner tone="amber" title={t("expiredTitle")} description={t("expiredDescription")} />;
    case "blocked":
      return (
        <Banner
          tone="red"
          title={t("blockedTitle")}
          description={
            <>
              {problem.reason && <p>{t("blockedReason", { reason: problem.reason })}</p>}
              {problem.message && <p className="mt-1">{problem.message}</p>}
              {!problem.reason && !problem.message && <p>{t("blockedDescription")}</p>}
            </>
          }
        />
      );
    case "rateLimited":
      return <Banner tone="amber" title={t("rateLimited")} action={retry} />;
    case "network":
      return <Banner tone="red" title={t("network")} action={retry} />;
  }
}

function Done({ email }: { email: string }) {
  const t = useTranslations("setPassword");
  const stores = useQuery({ queryKey: appAuthKeys.storeUrls(), queryFn: getStoreUrls, retry: false });
  const links = [
    { href: stores.data?.android, label: t("getAndroid") },
    { href: stores.data?.ios, label: t("getIos") },
  ].filter((l): l is { href: string; label: string } => !!l.href);
  return (
    <div className="flex flex-col gap-4">
      <Banner tone="green" title={t("doneTitle")} description={t("doneDescription", { email: ltr(email) })} />
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[34px] items-center justify-center rounded-md border border-border bg-surface px-3.5 text-14 font-medium text-ink transition-colors hover:bg-canvas"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
