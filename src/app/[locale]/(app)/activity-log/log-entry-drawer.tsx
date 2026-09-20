"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { DialogRoot, DrawerContent } from "@/components/feedback/dialog";
import { ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { DiffList } from "@/components/forms/editors";
import { Button } from "@/components/ui/button";
import { KeyValueList } from "@/components/ui/key-value-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import {
  activityLogKeys,
  actorHref,
  changesToRows,
  getActivityLogEntry,
  objectHref,
} from "@/lib/api/activity-log";
import { intlLocale } from "@/lib/utils/format";
import { useActionLabel } from "./action-label";

function show(v: unknown): ReactNode {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return <span dir="ltr">{JSON.stringify(v)}</span>;
  return String(v);
}

/** LOG-02 — entry detail drawer (`?entry=<id>`). Read-only. */
export function LogEntryDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("activityLog");
  const locale = useLocale();
  const router = useRouter();
  const actionLabel = useActionLabel();
  const entry = useQuery({
    queryKey: activityLogKeys.detail(id ?? ""),
    queryFn: () => getActivityLogEntry(id!),
    enabled: !!id,
  });
  const e = entry.data;
  const when = e
    ? new Intl.DateTimeFormat(intlLocale(locale), {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(e.createdAt))
    : "";
  const objHref = e ? objectHref(e.object?.type ?? e.objectType, e.object?.id ?? e.objectId) : null;
  const objType = e?.object?.type ?? e?.objectType ?? "";
  const objTypeLabel = t.has(`objectTypes.${objType}`) ? t(`objectTypes.${objType}`) : objType;
  const rows = e ? changesToRows(e.changes) : [];

  return (
    <DialogRoot open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent
        width={500}
        title={e ? actionLabel(e.action) : t("entry")}
        description={
          e ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge domain="auditLevel" status={e.level} label={t(`levels.${e.level}`)} />
              <span>{when}</span>
            </span>
          ) : undefined
        }
        footer={
          <>
            <span className="me-auto text-12 text-muted">{t("readOnly")}</span>
            <Button
              variant="secondary"
              icon={<Link2 />}
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href);
                toast.success(t("linkCopied"));
              }}
            >
              {t("copyLink")}
            </Button>
            {objHref && (
              <Button icon={<ChevronRight className="flip-rtl" />} onClick={() => router.push(objHref)}>
                {t("openObject", { type: objTypeLabel })}
              </Button>
            )}
          </>
        }
      >
        {entry.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded-sm bg-gray-soft" />
            ))}
          </div>
        ) : entry.isError ? (
          <ErrorState error={entry.error} onRetry={() => void entry.refetch()} />
        ) : e ? (
          <div className="flex flex-col gap-5">
            <KeyValueList
              rows={[
                {
                  label: t("detail.by"),
                  value: e.actor
                    ? `${e.actor.fullName}${e.actor.role ? ` (${t.has(`roles.${e.actor.role}`) ? t(`roles.${e.actor.role}`) : e.actor.role})` : ""}`
                    : t("system"),
                  href: actorHref(e.actor) ?? undefined,
                },
                {
                  label: t("detail.on"),
                  value: [objTypeLabel, e.object?.label ?? e.objectLabel].filter(Boolean).join(" · ") || "—",
                  href: objHref ?? undefined,
                },
                {
                  label: t("detail.source"),
                  value: <span>{[t(`sources.${e.source}`), e.ip].filter(Boolean).join(" · ")}</span>,
                },
                ...(e.userAgent
                  ? [{ label: t("detail.userAgent"), value: <span title={e.userAgent}>{e.userAgent}</span> }]
                  : []),
                ...(e.requestId
                  ? [{ label: t("detail.requestId"), value: <span dir="ltr">{e.requestId}</span> }]
                  : []),
              ]}
            />
            <section>
              <h3 className="mb-2 text-14 font-semibold text-ink">{t("detail.changes")}</h3>
              {rows.length > 0 ? (
                <DiffList
                  rows={rows.map((r) => ({
                    label: <span dir="ltr">{r.field}</span>,
                    old: show(r.old),
                    new: show(r.new),
                  }))}
                />
              ) : (
                <p className="text-13 text-muted">{t("detail.noChanges")}</p>
              )}
            </section>
            {e.note && (
              <section>
                <h3 className="mb-2 text-14 font-semibold text-ink">{t("detail.note")}</h3>
                <p className="rounded-lg border border-border px-3 py-2.5 text-13 whitespace-pre-wrap text-ink">
                  {e.note}
                </p>
              </section>
            )}
          </div>
        ) : null}
      </DrawerContent>
    </DialogRoot>
  );
}
