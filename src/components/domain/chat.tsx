"use client";

import { Eye, EyeOff, Send, ShieldAlert, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { initials, intlLocale } from "@/lib/utils/format";

export interface ChatMessageView {
  id: string;
  kind: "text" | "attachment" | "system";
  senderLabel: string;
  /** Right side: the provider / support (Figma), left: the client. */
  side?: "start" | "end";
  /** Original text (admins). */
  body: string | null;
  /** What participants see; null when nothing is masked. */
  bodyMasked?: string | null;
  masked?: boolean;
  status: "visible" | "hidden" | "deleted";
  reportsOpen?: number;
  createdAt: string;
}

const time = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * One message (MSG-01, BKG-03 preview). Admins see the original text; a masked message shows
 * "Contact details masked for users" with the masked version on demand. Flagged (reported) messages are red.
 */
export function MessageBubble({
  message: m,
  onModerate,
  pending,
  showTime = "time",
}: {
  message: ChatMessageView;
  onModerate?: (action: "hide" | "unhide" | "delete") => void;
  pending?: boolean;
  showTime?: "time" | "none" | ((iso: string) => string);
}) {
  const t = useTranslations("domain.chat");
  const locale = useLocale();
  const [showMasked, setShowMasked] = useState(false);

  if (m.kind === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-pill bg-gray-soft px-3 py-1 text-12 text-ink-2">
          {m.body}
          {showTime !== "none" && (
            <span className="text-muted">
              {" · "}
              {typeof showTime === "function" ? showTime(m.createdAt) : time(m.createdAt, locale)}
            </span>
          )}
        </span>
      </div>
    );
  }

  const flagged = (m.reportsOpen ?? 0) > 0;
  const end = m.side === "end";
  const removed = m.status !== "visible";
  const stamp =
    showTime === "none"
      ? null
      : typeof showTime === "function"
        ? showTime(m.createdAt)
        : time(m.createdAt, locale);

  return (
    <div
      className={cn("group flex items-start gap-2.5", end && "flex-row-reverse")}
      data-testid="message"
      data-status={m.status}
    >
      <span
        aria-hidden
        className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-11 font-semibold text-brand"
      >
        {initials(m.senderLabel)}
      </span>
      <div className={cn("flex max-w-[78%] min-w-0 items-start gap-2", end && "flex-row-reverse")}>
        <div
          className={cn(
            "min-w-0 rounded-xl border px-3 py-2",
            flagged
              ? "border-red/30 bg-red-soft"
              : end
                ? "border-transparent bg-brand-soft"
                : "border-border bg-surface",
            removed && "opacity-70",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 text-12">
            <span className={cn("font-medium", end || flagged ? "text-brand" : "text-ink")}>
              {m.senderLabel}
            </span>
            {stamp && <span className="text-faint">{stamp}</span>}
            {flagged && <span className="font-medium text-red">{t("flagged")}</span>}
            {m.status === "hidden" && <span className="font-medium text-amber">{t("hidden")}</span>}
            {m.status === "deleted" && <span className="font-medium text-red">{t("deleted")}</span>}
          </div>
          <p
            className={cn(
              "mt-0.5 text-14 break-words whitespace-pre-line text-ink",
              m.status === "deleted" && "line-through",
            )}
          >
            {showMasked && m.bodyMasked ? m.bodyMasked : m.body}
          </p>
          {m.masked && (
            <button
              type="button"
              onClick={() => setShowMasked((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-11 text-muted hover:text-ink"
              aria-pressed={showMasked}
              title={t("maskedHint")}
            >
              <ShieldAlert className="size-3" aria-hidden />
              {showMasked ? t("showOriginal") : t("maskedForUsers")}
            </button>
          )}
        </div>
        {onModerate && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 pt-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100",
              flagged && "sm:opacity-100",
            )}
          >
            {m.status === "hidden" ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<Eye />}
                disabled={pending}
                onClick={() => onModerate("unhide")}
              >
                {t("unhide")}
              </Button>
            ) : m.status === "visible" ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<EyeOff />}
                disabled={pending}
                onClick={() => onModerate("hide")}
              >
                {t("hide")}
              </Button>
            ) : null}
            {m.status !== "deleted" && (
              <Button
                size="sm"
                variant="danger-outline"
                icon={<Trash2 />}
                disabled={pending}
                onClick={() => onModerate("delete")}
              >
                {t("delete")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Write as Eventor support" input + Send. Enter sends, Shift+Enter adds a line. */
export function Composer({
  onSend,
  disabled,
  placeholder,
  closedSlot,
}: {
  onSend: (body: string) => Promise<unknown>;
  disabled?: boolean;
  placeholder?: string;
  /** Replaces the composer (MSG-03 "Closed · Reopen"). */
  closedSlot?: ReactNode;
}) {
  const t = useTranslations("domain.chat");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  if (closedSlot) {
    return <div className="border-t border-border px-5 py-3">{closedSlot}</div>;
  }
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    try {
      await onSend(text);
      setBody("");
    } catch {
      /* keep the text; the caller shows the error */
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-border px-5 py-3">
      <label className="sr-only" htmlFor="composer">
        {placeholder ?? t("placeholder")}
      </label>
      <textarea
        id="composer"
        rows={1}
        value={body}
        maxLength={5000}
        disabled={disabled || pending}
        placeholder={placeholder ?? t("placeholder")}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-14 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-canvas"
      />
      <Button type="submit" icon={<Send />} loading={pending} disabled={disabled || !body.trim()}>
        {t("send")}
      </Button>
    </form>
  );
}
