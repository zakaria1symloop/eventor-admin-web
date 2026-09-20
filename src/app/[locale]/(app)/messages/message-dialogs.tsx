"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, MessageCircle, Send, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { toast } from "@/components/feedback/toast";
import { Checkbox, Field, RadioCards, Textarea } from "@/components/forms/fields";
import { AsyncSelect, type Option } from "@/components/forms/select-inputs";
import { Button } from "@/components/ui/button";
import { bookingKeys, getBooking, listBookings, offerTitle } from "@/lib/api/bookings";
import {
  CLOSE_REASONS,
  closeConversation,
  createConversation,
  type ConversationDetail,
} from "@/lib/api/messaging";
import { getUser, listUsers, userKeys } from "@/lib/api/users";
import { initials } from "@/lib/utils/format";

/* ------------------------------------------------------------------ MSG-02 new message */

export function NewMessageDialog({
  open,
  onOpenChange,
  toUserIds,
  bookingId,
  lockRecipients,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled recipients (profile, booking parties, "Warn"). */
  toUserIds?: string[];
  bookingId?: string | null;
  /** From a profile the recipient can't be changed (screen map MSG-02). */
  lockRecipients?: boolean;
  onSent: (conversation: ConversationDetail) => void;
}) {
  const t = useTranslations("inbox.new");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [to, setTo] = useState<Option[]>([]);
  const [booking, setBooking] = useState<Option | null>(null);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillKey = (toUserIds ?? []).join(",");
  const prefill = useQuery({
    queryKey: [...userKeys.all, "message-prefill", prefillKey],
    queryFn: () => Promise.all((toUserIds ?? []).map((id) => getUser(id))),
    enabled: open && prefillKey.length > 0,
  });
  const prefillBooking = useQuery({
    queryKey: bookingKeys.detail(bookingId ?? "none"),
    queryFn: () => getBooking(bookingId!),
    enabled: open && !!bookingId,
  });

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTo([]);
      setBooking(null);
      setBody("");
      setEmail(false);
      setSubmitted(false);
      setError(null);
    }
  }
  const [appliedPrefill, setAppliedPrefill] = useState<unknown>(null);
  if (open && prefill.data && appliedPrefill !== prefill.data) {
    setAppliedPrefill(prefill.data);
    setTo(
      prefill.data.map((u) => ({
        value: u.id,
        label: u.businessName ? `${u.fullName} · ${u.businessName}` : u.fullName,
      })),
    );
  }
  const [appliedBooking, setAppliedBooking] = useState<unknown>(null);
  if (open && prefillBooking.data && appliedBooking !== prefillBooking.data) {
    setAppliedBooking(prefillBooking.data);
    setBooking({ value: prefillBooking.data.id, label: `#${prefillBooking.data.reference}` });
  }

  async function send() {
    setSubmitted(true);
    if (to.length === 0 || !body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const conversation = await createConversation({
        userIds: to.map((o) => o.value),
        body: body.trim(),
        bookingId: booking?.value,
        email: email || undefined,
      });
      toast.success(t("sent"));
      onOpenChange(false);
      onSent(conversation);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        width={520}
        icon={<MessageCircle />}
        title={t("title")}
        description={t("description")}
        footer={
          <>
            <span className="me-auto" />
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button icon={<Send />} loading={pending} onClick={() => void send()}>
              {t("send")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="red" title={error} />}
          <Field label={t("to")} required error={submitted && to.length === 0 ? tc("required") : undefined}>
            <div className="flex flex-col gap-2">
              {to.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={t("recipients")}>
                  {to.map((o) => (
                    <li
                      key={o.value}
                      className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-brand-soft ps-1 pe-1.5 text-12 font-medium text-brand"
                    >
                      <span className="flex size-5 items-center justify-center rounded-full bg-surface text-11">
                        {initials(o.label)}
                      </span>
                      {o.label}
                      {!lockRecipients && (
                        <button
                          type="button"
                          aria-label={t("removeRecipient", { name: o.label })}
                          onClick={() => setTo(to.filter((x) => x.value !== o.value))}
                          className="rounded-full hover:bg-brand/10"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!lockRecipients && to.length < 10 && (
                <AsyncSelect
                  aria-label={t("addRecipient")}
                  value={null}
                  placeholder={to.length ? t("addAnother") : t("searchUsers")}
                  queryKey={[...userKeys.all, "message-search"]}
                  queryFn={async (q) =>
                    (await listUsers({ q: q || undefined, limit: 20 })).data
                      .filter((u) => u.role !== "admin")
                      .map((u) => ({
                        value: u.id,
                        label: u.businessName ? `${u.fullName} · ${u.businessName}` : u.fullName,
                        sub: `${u.role === "provider" ? t("provider") : t("client")} · ${u.email}`,
                      }))
                  }
                  onValueChange={(o) => {
                    if (o && !to.some((x) => x.value === o.value)) setTo([...to, o]);
                  }}
                />
              )}
            </div>
          </Field>
          <Field label={t("about")} hint={t("aboutHint")}>
            <AsyncSelect
              value={booking}
              onValueChange={setBooking}
              placeholder={t("bookingPlaceholder")}
              queryKey={[...bookingKeys.all, "message-search", to.map((o) => o.value).join(",")]}
              queryFn={async (q) =>
                (await listBookings({ q: q || undefined, limit: 20 })).data.map((b) => ({
                  value: b.id,
                  label: `#${b.reference}`,
                  sub: `${offerTitle(b, locale)} · ${b.client.fullName}`,
                }))
              }
            />
          </Field>
          <Field label={t("message")} required error={submitted && !body.trim() ? tc("required") : undefined}>
            <Textarea rows={5} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Checkbox label={t("email")} checked={email} onCheckedChange={setEmail} />
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/* ------------------------------------------------------------------ MSG-03 close */

export function CloseConversationDialog({
  conversation: c,
  open,
  onOpenChange,
  onDone,
}: {
  conversation: ConversationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (c: ConversationDetail) => void;
}) {
  const t = useTranslations("inbox.close");
  const people = c.participants.filter((p) => p.role !== "support");
  const [scope, setScope] = useState<string>("all");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setScope("all");
  }
  const names = people.map((p) => p.fullName).join(" & ");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Ban />}
      title={t("title")}
      description={[names, c.booking ? `#${c.booking.reference}` : null].filter(Boolean).join(" · ")}
      reasonField={{
        required: true,
        options: CLOSE_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })),
      }}
      checkboxes={
        c.reports.length > 0
          ? [
              {
                name: "resolveReports",
                label: t("resolveReports", { count: c.reports.length }),
                defaultChecked: true,
              },
            ]
          : undefined
      }
      footerNote={t("canReopen")}
      confirmLabel={t("confirm")}
      onConfirm={async (values) => {
        const userId = scope.startsWith("user:") ? scope.slice(5) : undefined;
        const detail = await closeConversation(c.id, {
          scope: userId ? "one_participant" : "all",
          userId,
          reason: values.reason,
          resolveReports: values.checkboxes.resolveReports || undefined,
        });
        toast.success(t("closed"));
        onDone(detail);
      }}
    >
      <RadioCards
        aria-label={t("scope")}
        value={scope}
        onValueChange={setScope}
        options={[
          { value: "all", label: t("all"), description: t("allHint") },
          ...people.map((p) => ({
            value: `user:${p.id}`,
            label: t("one", { name: p.fullName }),
            description: t("oneHint", {
              other: people.find((x) => x.id !== p.id)?.fullName ?? t("others"),
            }),
          })),
        ]}
      />
    </ConfirmDialog>
  );
}
