"use client";

import { EyeOff, FolderInput, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { toast } from "@/components/feedback/toast";
import { ApiError } from "@/lib/api/errors";
import {
  deleteService,
  hideService,
  HIDE_REASONS,
  serviceAction,
  updateService,
  type HideReason,
  type ServiceDeleted,
} from "@/lib/api/services";

export interface ServiceTarget {
  id: string;
  title: string;
  providerName?: string | null;
}

/** Known impact of deleting one service (SRV-06). Omit what the caller doesn't know. */
export interface DeleteImpact {
  pendingBookings?: number;
  upcomingBookings?: number;
  packs?: string[];
  reviews?: number;
}

/* ------------------------------------------------------------------ SRV-03 Hide */

export function HideServiceDialog({
  services,
  open,
  onOpenChange,
  pendingBookings,
  onDone,
}: {
  services: ServiceTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingBookings?: number;
  onDone: () => void;
}) {
  const t = useTranslations("services.hide");
  const single = services.length === 1 ? services[0] : null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="warning"
      icon={<EyeOff />}
      title={single ? t("title", { title: single.title }) : t("titleMany", { count: services.length })}
      description={t("description")}
      reasonField={{
        required: true,
        options: HIDE_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })),
      }}
      messageField={{ label: t("message"), placeholder: t("messagePlaceholder") }}
      checkboxes={[{ name: "allowResubmit", label: t("allowResubmit"), defaultChecked: true }]}
      footerNote={pendingBookings !== undefined ? t("pendingStay", { count: pendingBookings }) : undefined}
      confirmLabel={t("confirm")}
      onConfirm={async (v) => {
        for (const s of services) {
          await hideService(s.id, {
            reason: v.reason as HideReason,
            message: v.message.trim() || null,
            allowResubmit: !!v.checkboxes.allowResubmit,
          });
        }
        toast.success(
          single ? t("done", { title: single.title }) : t("doneMany", { count: services.length }),
          {
            action: {
              label: t("undo"),
              onClick: () =>
                void Promise.all(services.map((s) => serviceAction(s.id, "show")))
                  .then(onDone)
                  .catch((e) => toast.apiError(e)),
            },
          },
        );
        onDone();
      }}
    />
  );
}

/* ------------------------------------------------------------------ SRV-06 Delete (with force) */

export function DeleteServiceDialog({
  service,
  open,
  onOpenChange,
  impact,
  onHideInstead,
  onDeleted,
}: {
  service: ServiceTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impact?: DeleteImpact;
  onHideInstead?: () => void;
  onDeleted: (result: ServiceDeleted) => void;
}) {
  const t = useTranslations("services.delete");
  // 409 SERVICE_HAS_BOOKINGS: accepted upcoming bookings; the admin may override (`force=true`).
  const [blocked, setBlocked] = useState<number | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBlocked(null);
  }

  const lines = [
    impact?.pendingBookings !== undefined && t("impact.pending", { count: impact.pendingBookings }),
    impact?.upcomingBookings !== undefined && t("impact.upcoming", { count: impact.upcomingBookings }),
    ...(impact?.packs ?? []).map((name) => t("impact.pack", { name })),
    impact?.reviews !== undefined && t("impact.reviews", { count: impact.reviews }),
  ].filter((l): l is string => !!l);

  return (
    <ConfirmDialog
      open={open && !!service}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Trash2 />}
      title={t("title")}
      description={[service?.title, service?.providerName].filter(Boolean).join(" · ")}
      impact={lines.length ? lines : [t("impact.generic")]}
      impactTitle={t("impactTitle")}
      checkboxes={
        blocked !== null
          ? [
              {
                name: "force",
                label: t("force", { count: blocked }),
                description: t("forceHint"),
              },
            ]
          : undefined
      }
      footerNote={t("tip")}
      secondaryAction={onHideInstead ? { label: t("hideInstead"), onClick: onHideInstead } : undefined}
      confirmLabel={blocked !== null ? t("confirmForce") : t("confirm")}
      onConfirm={async (v) => {
        if (!service) return;
        const force = blocked !== null && !!v.checkboxes.force;
        if (blocked !== null && !force) throw new Error(t("forceRequired", { count: blocked }));
        try {
          const result = await deleteService(service.id, force);
          toast.success(t("done", { title: service.title }), {
            description:
              result.cancelledBookings || result.keptUpcomingBookings || result.packsNeedingAttention
                ? t("doneDetail", {
                    cancelled: result.cancelledBookings,
                    kept: result.keptUpcomingBookings,
                    packs: result.packsNeedingAttention,
                  })
                : undefined,
          });
          onDeleted(result);
        } catch (e) {
          if (e instanceof ApiError && e.code === "SERVICE_HAS_BOOKINGS") {
            const d = e.details as { upcomingBookings?: number } | null;
            setBlocked(d?.upcomingBookings ?? 0);
            throw new Error(t("hasBookings", { count: d?.upcomingBookings ?? 0 }));
          }
          throw e;
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ bulk delete / show / change category */

export function BulkDeleteServicesDialog({
  services,
  onOpenChange,
  onDone,
}: {
  services: ServiceTarget[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("services.delete");
  return (
    <ConfirmDialog
      open={services.length > 0}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Trash2 />}
      title={t("titleMany", { count: services.length })}
      impact={[t("impact.bulk"), t("impact.bulkRefused")]}
      impactTitle={t("impactTitle")}
      confirmLabel={t("confirm")}
      onConfirm={async () => {
        let deleted = 0;
        const refused: string[] = [];
        for (const s of services) {
          try {
            await deleteService(s.id);
            deleted += 1;
          } catch (e) {
            if (e instanceof ApiError && e.code === "SERVICE_HAS_BOOKINGS") refused.push(s.title);
            else throw e;
          }
        }
        onDone();
        if (refused.length) {
          toast.error(t("bulkRefused", { deleted, refused: refused.length }), {
            description: refused.join(", "),
          });
        } else {
          toast.success(t("doneMany", { count: deleted }));
        }
      }}
    />
  );
}

export async function showServices(
  services: ServiceTarget[],
  t: (key: string, values?: Record<string, string | number>) => string,
  onDone: () => void,
) {
  try {
    for (const s of services) await serviceAction(s.id, "show");
    toast.success(
      services.length === 1
        ? t("shown", { title: services[0].title })
        : t("shownMany", { count: services.length }),
    );
  } catch (e) {
    const missing = e instanceof ApiError && e.code === "SERVICE_PUBLISH_INVALID";
    if (missing) toast.error(t("showInvalid"));
    else toast.apiError(e);
  } finally {
    onDone();
  }
}

export function ChangeCategoryDialog({
  services,
  options,
  onOpenChange,
  onDone,
}: {
  services: ServiceTarget[];
  options: { value: string; label: string }[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("services.changeCategory");
  const locale = useLocale();
  return (
    <ConfirmDialog
      key={locale}
      open={services.length > 0}
      onOpenChange={onOpenChange}
      icon={<FolderInput />}
      title={t("title", { count: services.length })}
      description={t("description")}
      reasonField={{ label: t("category"), options, required: true, requiredMessage: t("required") }}
      confirmLabel={t("confirm")}
      onConfirm={async (v) => {
        for (const s of services) await updateService(s.id, { categoryId: v.reason });
        toast.success(t("done", { count: services.length }));
        onDone();
      }}
    />
  );
}

/** Feature on home / unfeature with Undo (SRV-02). */
export async function toggleFeatured(
  service: ServiceTarget & { isFeatured: boolean },
  t: (key: string, values?: Record<string, string | number>) => string,
  onDone: () => void,
) {
  const next = service.isFeatured ? "unfeature" : "feature";
  try {
    await serviceAction(service.id, next);
    onDone();
    toast.success(
      next === "feature"
        ? t("featured", { title: service.title })
        : t("unfeatured", { title: service.title }),
      {
        action: {
          label: t("undo"),
          onClick: () =>
            void serviceAction(service.id, next === "feature" ? "unfeature" : "feature")
              .then(onDone)
              .catch((e) => toast.apiError(e)),
        },
      },
    );
  } catch (e) {
    if (e instanceof ApiError && e.code === "FEATURED_LIMIT") toast.error(t("featuredLimit"));
    else toast.apiError(e);
  }
}
