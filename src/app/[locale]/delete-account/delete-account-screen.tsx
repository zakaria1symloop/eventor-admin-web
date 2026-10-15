"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Banner } from "@/components/feedback/banner";
import { Checkbox, Field } from "@/components/forms/fields";
import { EmailInput, PasswordInput } from "@/components/forms/inputs";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { deleteAccountFromWeb } from "@/lib/api/legal";
import { PublicFrame } from "../f/public-form-screens";

const SECTIONS = ["now", "later", "kept", "refused"] as const;

/** Explains what deletion removes and keeps, then deletes with the account's email and password. */
export function DeleteAccountScreen() {
  const t = useTranslations("deleteAccount");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await deleteAccountFromWeb(email.trim(), password);
      setDone(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setPending(false);
    }
  }

  function message(err: unknown): string {
    if (!(err instanceof ApiError)) return t("errors.generic");
    switch (err.code) {
      case "INVALID_CREDENTIALS":
        return t("errors.credentials");
      case "ACCOUNT_LOCKED": {
        const seconds = (err.details as { retryAfterSeconds?: number } | null)?.retryAfterSeconds ?? 900;
        return t("errors.locked", { minutes: Math.max(1, Math.ceil(seconds / 60)) });
      }
      case "ACCOUNT_HAS_ACTIVE_ITEMS":
        return t("errors.activeItems");
      case "ROLE_NOT_ALLOWED_IN_APP":
        return t("errors.admin");
      case "RATE_LIMITED":
        return t("errors.rateLimited");
      default:
        return err.message || t("errors.generic");
    }
  }

  if (done) {
    return (
      <PublicFrame title={t("title")}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-10 text-green" aria-hidden />
          <h2 className="text-16 font-semibold text-ink">{t("doneTitle")}</h2>
          <p className="max-w-sm text-14 text-ink-2">{t("doneDescription")}</p>
        </div>
      </PublicFrame>
    );
  }

  return (
    <PublicFrame title={t("title")}>
      <p className="text-14 text-ink-2">{t("intro")}</p>
      <div className="mt-4 space-y-4">
        {SECTIONS.map((s) => (
          <section key={s}>
            <h2 className="text-14 font-semibold text-ink">{t(`sections.${s}.title`)}</h2>
            <p className="mt-1 text-13 leading-relaxed text-ink-2">{t(`sections.${s}.body`)}</p>
          </section>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4 border-t border-border pt-5" noValidate>
        <h2 className="text-16 font-semibold text-ink">{t("formTitle")}</h2>
        <p className="text-13 text-muted">{t("formHint")}</p>
        {error && <Banner tone="red" title={error} />}
        <Field label={t("email")} required>
          <EmailInput autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("password")} required hint={t("forgot")}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Checkbox checked={understood} onCheckedChange={setUnderstood} label={t("understood")} />
        <Button
          type="submit"
          variant="danger"
          className="w-full"
          loading={pending}
          disabled={!understood || email.trim() === "" || password === ""}
        >
          {t("submit")}
        </Button>
        <p className="text-12 text-muted">
          {t("inApp")}{" "}
          <Link href="/legal/privacy" className="font-medium text-brand hover:underline">
            {t("privacy")}
          </Link>
        </p>
      </form>
    </PublicFrame>
  );
}
