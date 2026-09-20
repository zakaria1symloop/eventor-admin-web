"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, RotateCw, Trash2, UserPlus, XCircle } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormDialog } from "@/components/feedback/form-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Field, TextInput } from "@/components/forms/fields";
import { EmailInput } from "@/components/forms/inputs";
import {
  adminKeys,
  inviteAdmin,
  listAdmins,
  removeAdmin,
  resendInvitation,
  revokeInvitation,
  type AdminAccount,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { formatDate, formatRelative, initials } from "@/lib/utils/format";

type Pending = { kind: "remove" | "revoke"; admin: AdminAccount } | null;

/** SET-01 "Admin accounts" + SET-02 invite dialog (`?invite=1`). */
export function AdminAccountsSection({ id }: { id?: string }) {
  const t = useTranslations("admins");
  const tc = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useQueryState(
    "invite",
    parseAsBoolean.withDefault(false).withOptions({ history: "replace" }),
  );
  const [pending, setPending] = useState<Pending>(null);
  const [now] = useState(() => Date.now());

  const admins = useQuery({ queryKey: adminKeys.list(), queryFn: listAdmins });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.all });

  const resend = useMutation({
    mutationFn: (a: AdminAccount) => resendInvitation(a.invitationId!),
    onSuccess: (_d, a) => {
      toast.success(t("resent", { email: a.email }));
      void invalidate();
    },
    onError: (e) => toast.apiError(e),
  });

  const schema = z.object({
    fullName: z.string().trim().min(2, t("fullNameRequired")).max(120),
    email: z.string().trim().min(1, t("emailRequired")).email(t("emailInvalid")),
  });

  function statusPill(a: AdminAccount) {
    if (a.status === "invited") {
      const expired = a.expiresAt && new Date(a.expiresAt).getTime() < now;
      return expired ? (
        <Pill tone="red">{t("invitationExpired")}</Pill>
      ) : (
        <Pill tone="amber">
          {t("invitationSent", { when: a.invitedAt ? formatRelative(a.invitedAt, locale) : "" })}
        </Pill>
      );
    }
    if (a.isCurrentUser) return <Pill tone="green">{t("activeNow")}</Pill>;
    return a.lastActiveAt ? (
      <Pill tone="green">{t("lastSeen", { date: formatDate(a.lastActiveAt, locale) })}</Pill>
    ) : (
      <Pill tone="gray">{t("neverSignedIn")}</Pill>
    );
  }

  const activeCount = admins.data?.data.filter((a) => a.status === "active").length ?? 0;

  return (
    <Card id={id} className="scroll-mt-24 overflow-hidden">
      <CardHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button icon={<Plus />} onClick={() => void setInviteOpen(true)}>
            {t("invite")}
          </Button>
        }
      />
      {admins.isPending ? (
        <TableSkeleton rows={3} columns={2} />
      ) : admins.isError ? (
        <ErrorState error={admins.error} onRetry={() => void admins.refetch()} />
      ) : admins.data.data.length === 0 ? (
        <EmptyState icon={<UserPlus />} title={t("empty")} />
      ) : (
        <ul className="divide-y divide-border">
          {admins.data.data.map((a) => {
            const isLast = a.status === "active" && activeCount <= 1;
            return (
              <li key={a.id} className="flex items-center gap-3 px-[18px] py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-12 font-semibold text-brand">
                  {initials(a.fullName)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-14 font-medium text-ink">{a.fullName}</span>
                    {a.isCurrentUser && (
                      <Pill tone="brand" dot={false} className="h-[18px] text-11">
                        {t("you")}
                      </Pill>
                    )}
                  </div>
                  <span className="block truncate text-12 text-muted" dir="ltr">
                    {a.email}
                  </span>
                </div>
                <span className="hidden sm:inline-flex">{statusPill(a)}</span>
                <ActionMenu
                  header={{ title: a.fullName, subtitle: a.email }}
                  groups={
                    a.status === "invited"
                      ? [
                          [{ icon: <RotateCw />, label: t("resend"), onSelect: () => resend.mutate(a) }],
                          [
                            {
                              icon: <XCircle />,
                              label: t("revoke"),
                              danger: true,
                              onSelect: () => setPending({ kind: "revoke", admin: a }),
                            },
                          ],
                        ]
                      : [
                          [
                            {
                              icon: <Trash2 />,
                              label: t("remove"),
                              danger: true,
                              disabled: a.isCurrentUser || isLast,
                              hint: a.isCurrentUser
                                ? t("cannotRemoveSelfShort")
                                : isLast
                                  ? t("lastAdminShort")
                                  : undefined,
                              onSelect: () => setPending({ kind: "remove", admin: a }),
                            },
                          ],
                        ]
                  }
                  trigger={
                    <IconButton label={t("rowActions", { name: a.fullName })} size="sm">
                      <MoreHorizontal />
                    </IconButton>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <FormDialog
        open={inviteOpen}
        onOpenChange={(o) => void setInviteOpen(o ? true : null)}
        title={t("inviteTitle")}
        description={t("inviteDescription")}
        schema={schema}
        defaultValues={{ fullName: "", email: "" }}
        submitLabel={t("send")}
        width={480}
        fields={(form) => (
          <>
            <Field label={t("fullName")} required error={form.formState.errors.fullName?.message}>
              <TextInput autoComplete="off" {...form.register("fullName")} />
            </Field>
            <Field
              label={t("email")}
              required
              hint={t("validFor")}
              error={form.formState.errors.email?.message}
            >
              <EmailInput autoComplete="off" {...form.register("email")} />
            </Field>
            <Banner tone="amber" title={t("oneRoleWarning")} />
          </>
        )}
        onSubmit={async (values) => {
          try {
            await inviteAdmin({ fullName: values.fullName.trim(), email: values.email.trim() });
          } catch (e) {
            if (e instanceof ApiError && (e.code === "EMAIL_TAKEN" || e.code === "INVITATION_EXISTS")) {
              // Show under the email field.
              throw new ApiError({
                status: e.status,
                code: "VALIDATION_FAILED",
                message: e.message,
                details: [{ field: "email", code: e.code, message: e.message }],
                requestId: e.requestId,
              });
            }
            throw e;
          }
          toast.success(t("invited", { email: values.email.trim() }));
          void invalidate();
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        tone="danger"
        icon={pending?.kind === "remove" ? <Trash2 /> : <XCircle />}
        title={
          pending?.kind === "remove"
            ? t("removeTitle", { name: pending.admin.fullName })
            : t("revokeTitle", { email: pending?.admin.email ?? "" })
        }
        description={pending?.kind === "remove" ? t("removeDescription") : t("revokeDescription")}
        confirmLabel={pending?.kind === "remove" ? t("remove") : t("revoke")}
        footerNote={tc("savedInActivityLog")}
        onConfirm={async () => {
          if (!pending) return;
          try {
            if (pending.kind === "remove") await removeAdmin(pending.admin.id);
            else await revokeInvitation(pending.admin.invitationId!);
          } catch (e) {
            if (e instanceof ApiError && e.code === "LAST_ADMIN") throw new Error(t("lastAdmin"));
            if (e instanceof ApiError && e.code === "CANNOT_REMOVE_SELF")
              throw new Error(t("cannotRemoveSelf"));
            throw e;
          }
          toast.success(
            pending.kind === "remove" ? t("removed", { name: pending.admin.fullName }) : t("revoked"),
          );
          void invalidate();
        }}
      />
    </Card>
  );
}
