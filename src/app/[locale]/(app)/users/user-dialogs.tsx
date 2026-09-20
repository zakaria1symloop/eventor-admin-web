"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Check, Copy, KeyRound, LogOut, Trash2, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { toast } from "@/components/feedback/toast";
import { Field, RadioCards, Select } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { UserCell } from "@/components/data-list/cells";
import { ApiError } from "@/lib/api/errors";
import {
  blockUser,
  bulkUsers,
  deleteUser,
  getBlockImpact,
  resetPassword,
  revokeSessions,
  unblockUser,
  userKeys,
  type ActiveItemsDetails,
  type BlockResult,
  type BookingChoice,
  type BulkAction,
  type BulkRefusedDetails,
  type UserRole,
} from "@/lib/api/users";

export interface UserTarget {
  id: string;
  fullName: string;
  role: UserRole;
  email?: string;
  businessName?: string | null;
}

function refusalLabel(code: string) {
  return code.toLowerCase().replace(/_/g, " ");
}

export const BLOCK_REASONS = ["no_shows", "fraud", "abuse", "fake_account", "spam", "other"] as const;
const DURATIONS = ["forever", "7d", "30d", "90d"] as const;

function untilFor(duration: string, now = new Date()): string | null {
  const days = { "7d": 7, "30d": 30, "90d": 90 }[duration];
  if (!days) return null;
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

/* ------------------------------------------------------------------ USR-07 block */

export function BlockUserDialog({
  user,
  open,
  onOpenChange,
  onBlocked,
}: {
  user: UserTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlocked?: (result: BlockResult) => void;
}) {
  const t = useTranslations("users.block");
  const tr = useTranslations("users.reasons");
  const tc = useTranslations("common");
  const [bookings, setBookings] = useState<BookingChoice>("cancel");
  const [duration, setDuration] = useState<string>("forever");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBookings("cancel");
      setDuration("forever");
    }
  }

  const impact = useQuery({
    queryKey: userKeys.impact(user?.id ?? ""),
    queryFn: () => getBlockImpact(user!.id),
    enabled: open && !!user,
  });
  if (!user) return null;
  const i = impact.data;
  const isProvider = user.role === "provider";

  const lines: string[] = [];
  if (impact.isPending) lines.push(t("impactLoading"));
  else if (impact.isError) lines.push(t("impactError"));
  else if (i) {
    lines.push(t("impactSignOut"));
    if (isProvider && i.servicesCount > 0) lines.push(t("impactServices", { count: i.servicesCount }));
    if (isProvider && i.packsCount > 0) lines.push(t("impactPacks", { count: i.packsCount }));
    if (i.conversations > 0) lines.push(t("impactConversations", { count: i.conversations }));
    if (i.upcomingBookings > 0) lines.push(t("impactUpcoming", { count: i.upcomingBookings }));
  }
  const pending = i?.pendingBookings ?? 0;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Ban />}
      title={t("title", { name: user.fullName })}
      description={isProvider ? t("descriptionProvider") : t("descriptionClient")}
      impact={lines}
      reasonField={{
        required: true,
        options: BLOCK_REASONS.map((r) => ({ value: r, label: tr(r) })),
        addon: (
          <Field label={t("duration")}>
            <Select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              options={DURATIONS.map((d) => ({ value: d, label: t(`durations.${d}`) }))}
            />
          </Field>
        ),
      }}
      messageField={{ label: t("message"), placeholder: t("messagePlaceholder") }}
      confirmLabel={t("confirm")}
      footerNote={tc("savedInActivityLog")}
      onConfirm={async ({ reason, message }) => {
        const result = await blockUser(user.id, {
          reason,
          until: untilFor(duration),
          message: message.trim() || null,
          bookings: pending > 0 ? bookings : "keep",
        });
        onBlocked?.(result);
      }}
    >
      {pending > 0 && (
        <div>
          <div className="mb-2 text-13 font-medium text-ink">
            {t("bookingsTitle", { pending, upcoming: i?.upcomingBookings ?? 0 })}
          </div>
          <RadioCards
            aria-label={t("bookingsTitle", { pending, upcoming: i?.upcomingBookings ?? 0 })}
            value={bookings}
            onValueChange={(v) => setBookings(v as BookingChoice)}
            options={[
              {
                value: "cancel",
                label: isProvider ? t("cancelProvider") : t("cancelClient"),
                description: isProvider ? t("cancelProviderHint") : t("cancelClientHint"),
              },
              { value: "keep", label: t("keep"), description: t("keepHint") },
            ]}
          />
        </div>
      )}
    </ConfirmDialog>
  );
}

/** Toast after blocking with Undo (USR-13). */
export function toastBlocked(
  t: (key: string, values?: Record<string, string | number>) => string,
  user: UserTarget,
  result: BlockResult,
  onUndone: () => void,
) {
  toast.success(t("blockedToast", { name: user.fullName }), {
    description: t("blockedToastHint", { count: result.cancelledBookings }),
    action: {
      label: t("undo"),
      onClick: () => {
        unblockUser(user.id).then(
          () => {
            toast.success(t("unblockedToast", { name: user.fullName }));
            onUndone();
          },
          (e) => toast.apiError(e),
        );
      },
    },
  });
}

/* ------------------------------------------------------------------ USR-08 delete */

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
  linked,
}: {
  user: UserTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  /** "48 bookings · 5 services · 32 reviews linked" */
  linked?: { bookings: number; services?: number | null; reviews?: number | null };
}) {
  const t = useTranslations("users.delete");
  const [mode, setMode] = useState("anonymise");
  if (!user) return null;
  const note = linked
    ? [
        t("linkedBookings", { count: linked.bookings }),
        linked.services != null ? t("linkedServices", { count: linked.services }) : null,
        linked.reviews != null ? t("linkedReviews", { count: linked.reviews }) : null,
      ]
        .filter(Boolean)
        .join(" · ") + ` ${t("linked")}`
    : undefined;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Trash2 />}
      title={t("title", { name: user.fullName })}
      description={t("description")}
      typeToConfirm={user.fullName}
      confirmLabel={t("confirm")}
      footerNote={note}
      onConfirm={async () => {
        try {
          await deleteUser(user.id, user.fullName);
        } catch (e) {
          if (e instanceof ApiError && e.code === "ACCOUNT_HAS_ACTIVE_ITEMS") {
            const d = (e.details ?? {}) as Partial<ActiveItemsDetails>;
            throw new Error(
              t("activeItems", { bookings: d.upcomingBookings ?? 0, disputes: d.openDisputes ?? 0 }),
            );
          }
          throw e;
        }
        toast.success(t("deletedToast", { name: user.fullName }));
        onDeleted?.();
      }}
    >
      <RadioCards
        aria-label={t("mode")}
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "anonymise", label: t("anonymise"), description: t("anonymiseHint") },
          { value: "everything", label: t("everything"), description: t("everythingHint"), disabled: true },
        ]}
      />
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ USR-09 reset password / sign out */

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  sessionsCount,
}: {
  user: UserTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionsCount?: number;
}) {
  const t = useTranslations("users.password");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<"link" | "temporary">("link");
  const [temp, setTemp] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMode("link");
  }
  if (!user) return null;
  return (
    <>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        icon={<KeyRound />}
        title={t("title")}
        description={[user.fullName, user.email].filter(Boolean).join(" · ")}
        confirmLabel={mode === "link" ? t("sendLink") : t("setTemporary")}
        footerNote={t("neverSee")}
        checkboxes={[
          {
            name: "signOut",
            label:
              sessionsCount !== undefined
                ? t("signOutToo", { count: sessionsCount })
                : t("signOutTooNoCount"),
            defaultChecked: true,
          },
        ]}
        onConfirm={async ({ checkboxes }) => {
          const res = await resetPassword(user.id, { mode, signOutEverywhere: !!checkboxes.signOut });
          if (res.mode === "temporary" && res.temporaryPassword) setTemp(res.temporaryPassword);
          else toast.success(t("linkSent", { email: user.email ?? user.fullName }));
        }}
      >
        <RadioCards
          aria-label={t("title")}
          value={mode}
          onValueChange={(v) => setMode(v as "link" | "temporary")}
          options={[
            { value: "link", label: t("link"), description: t("linkHint") },
            { value: "temporary", label: t("temporary"), description: t("temporaryHint") },
          ]}
        />
      </ConfirmDialog>
      <DialogRoot open={temp !== null} onOpenChange={(o) => !o && setTemp(null)}>
        <DialogContent
          title={t("temporaryTitle")}
          description={t("temporaryDescription", { name: user.fullName })}
          icon={<KeyRound />}
          width={460}
          footer={
            <>
              <span className="me-auto text-12 text-muted">{t("shownOnce")}</span>
              <Button onClick={() => setTemp(null)}>{tc("close")}</Button>
            </>
          }
        >
          <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2.5">
            <code dir="ltr" className="flex-1 font-mono text-16 text-ink" data-testid="temporary-password">
              {temp}
            </code>
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy />}
              onClick={() => {
                void navigator.clipboard?.writeText(temp ?? "");
                toast.success(t("copied"));
              }}
            >
              {t("copy")}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

export function SignOutEverywhereDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("users.signOut");
  const tc = useTranslations("common");
  if (!user) return null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<LogOut />}
      title={t("title", { name: user.fullName })}
      description={t("description")}
      confirmLabel={t("confirm")}
      footerNote={tc("savedInActivityLog")}
      onConfirm={async () => {
        const res = await revokeSessions(user.id);
        toast.success(t("done", { count: res.sessionsRevoked }));
      }}
    />
  );
}

/* ------------------------------------------------------------------ USR-04 bulk */

export function BulkUsersDialog({
  action,
  users,
  onOpenChange,
  onDone,
}: {
  action: BulkAction | null;
  users: (UserTarget & { servicesCount?: number | null; bookingsCount?: number })[];
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const t = useTranslations("users.bulk");
  const tr = useTranslations("users.reasons");
  const troles = useTranslations("status.role");
  const tc = useTranslations("common");
  if (!action) return null;
  const count = users.length;
  const icon = action === "block" ? <Ban /> : action === "unblock" ? <Unlock /> : <Trash2 />;
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      tone={action === "unblock" ? "default" : "danger"}
      icon={icon}
      title={t(`${action}Title`, { count })}
      description={t(`${action}Description`)}
      reasonField={
        action === "block"
          ? { required: true, options: BLOCK_REASONS.map((r) => ({ value: r, label: tr(r) })) }
          : undefined
      }
      messageField={
        action === "block" ? { label: t("message"), placeholder: t("messagePlaceholder") } : undefined
      }
      checkboxes={
        action === "block" ? [{ name: "cancel", label: t("cancelPending"), defaultChecked: true }] : undefined
      }
      confirmLabel={t(`${action}Confirm`, { count })}
      footerNote={tc("savedInActivityLog")}
      onConfirm={async ({ reason, message, checkboxes }) => {
        let res;
        try {
          res = await bulkUsers({
            action,
            ids: users.map((u) => u.id),
            ...(action === "block"
              ? { reason, message: message.trim() || null, bookings: checkboxes.cancel ? "cancel" : "keep" }
              : {}),
          });
        } catch (e) {
          // All-or-nothing: one refusal changes nothing (409 BULK_ACTION_REFUSED, details.refused).
          if (e instanceof ApiError && e.code === "BULK_ACTION_REFUSED") {
            const refused = ((e.details ?? {}) as Partial<BulkRefusedDetails>).refused ?? [];
            const names = refused
              .map((r) => {
                const name = users.find((u) => u.id === r.id)?.fullName ?? r.id;
                return `${name} (${refusalLabel(r.code)})`;
              })
              .join(", ");
            throw new Error(t("refused", { count: refused.length, names }));
          }
          throw e;
        }
        toast.success(t(`${action}Done`, { count: res.length }));
        onDone?.();
      }}
    >
      <ul className="max-h-[240px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {users.map((u) => (
          <li key={u.id} className="px-3 py-2.5">
            <UserCell
              name={u.fullName}
              sub={[
                troles(u.role),
                u.role === "provider" && u.servicesCount
                  ? t("servicesCount", { count: u.servicesCount })
                  : null,
                u.bookingsCount ? t("bookingsCount", { count: u.bookingsCount }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </li>
        ))}
      </ul>
      {action === "unblock" && (
        <p className="flex items-center gap-2 text-13 text-muted">
          <Check className="size-4 text-green" aria-hidden />
          {t("unblockHint")}
        </p>
      )}
    </ConfirmDialog>
  );
}
