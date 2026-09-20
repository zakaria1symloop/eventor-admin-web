"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarDays,
  Copy,
  Eye,
  FileText,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";
import { DataList, EntityCell, LinkCell, StackCell, type DataColumn } from "@/components/data-list";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormDialog } from "@/components/feedback/form-dialog";
import { EmptyState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { PageHeader } from "@/components/layout/page-header";
import type { ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  closeForm,
  createForm,
  deleteForm,
  duplicateForm,
  FORM_TABS,
  formKeys,
  formsQuery,
  listForms,
  publicFormPath,
  reopenForm,
  type FormList,
  type FormRow,
} from "@/lib/api/forms";
import { formatDate } from "@/lib/utils/format";
import { AcademicTabs } from "../academic-tabs";

export const builderHref = (f: { id: string }) => `/academic-requests/forms/${f.id}/edit`;

/** Absolute public link on this dashboard's origin, with the locale. */
export function publicFormUrl(slug: string, locale: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/${locale}${publicFormPath(slug)}`;
}

export async function copyFormLink(slug: string, locale: string, message: string) {
  try {
    await navigator.clipboard.writeText(publicFormUrl(slug, locale));
    toast.success(message);
  } catch (e) {
    toast.apiError(e);
  }
}

export function FormsScreen() {
  const t = useTranslations("academic.forms");
  const ta = useTranslations("academic");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useQueryState("new", parseAsString.withOptions({ history: "replace" }));
  const [deleting, setDeleting] = useState<FormRow | null>(null);
  const [closing, setClosing] = useState<FormRow | null>(null);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: formKeys.all });

  const name = (f: FormRow) => (locale === "ar" ? f.nameAr || f.nameEn : f.nameEn);

  const columns: DataColumn<FormRow>[] = [
    {
      id: "nameEn",
      header: t("columns.form"),
      hideable: false,
      sortable: true,
      cell: (f) => (
        <EntityCell
          icon={<FileText />}
          href={builderHref(f)}
          title={name(f)}
          sub={
            [
              f.isDefault ? t("default") : null,
              f.requiresAuth ? t("requiresAccount") : null,
              f.hasDraftChanges ? t("draftChanges") : null,
            ]
              .filter(Boolean)
              .join(" · ") || f.slug
          }
        />
      ),
    },
    {
      id: "link",
      header: t("columns.link"),
      cell: (f) =>
        f.status === "draft" ? (
          <span className="text-13 text-faint" dir="ltr">
            /f/{f.slug}
          </span>
        ) : (
          <LinkCell href={publicFormPath(f.slug)} label={<span dir="ltr">/f/{f.slug}</span>} />
        ),
    },
    {
      id: "version",
      header: t("columns.version"),
      cell: (f) => (
        <span className="text-13 text-ink">
          {f.liveVersion
            ? f.hasDraftChanges
              ? t("liveAndDraft", { version: f.liveVersion.version, next: f.liveVersion.version + 1 })
              : t("live", { version: f.liveVersion.version })
            : t("neverPublished")}
        </span>
      ),
    },
    {
      id: "submissionsCount",
      header: t("columns.submissions"),
      sortable: true,
      cell: (f) =>
        f.submissionsCount === 0 ? (
          <span className="text-13 text-faint">{t("requests", { count: 0 })}</span>
        ) : (
          <LinkCell
            href={`/academic-requests?tab=all&formId=${f.id}`}
            label={t("requests", { count: f.submissionsCount })}
          />
        ),
    },
    {
      id: "updatedAt",
      header: t("columns.updated"),
      sortable: true,
      cell: (f) => <StackCell primary={formatDate(f.updatedAt, locale)} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (f) => <StatusBadge domain="form" status={f.status} />,
    },
  ];

  async function run(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      toast.success(message);
      invalidate();
    } catch (e) {
      toast.apiError(e);
    }
  }

  const rowMenu = (f: FormRow): ActionMenuItem[][] => [
    [
      { icon: <Pencil />, label: t("menu.edit"), href: builderHref(f) },
      {
        icon: <Eye />,
        label: t("menu.preview"),
        onSelect: () =>
          f.status === "published"
            ? window.open(publicFormUrl(f.slug, locale), "_blank", "noopener")
            : router.push(`${builderHref(f)}?preview=1`),
      },
      {
        icon: <Copy />,
        label: t("menu.copyLink"),
        disabled: f.status === "draft",
        onSelect: () => void copyFormLink(f.slug, locale, t("linkCopied")),
      },
      {
        icon: <Layers />,
        label: t("menu.duplicate"),
        onSelect: () =>
          void duplicateForm(f.id).then(
            (copy) => {
              toast.success(t("duplicated"));
              invalidate();
              router.push(builderHref(copy));
            },
            (e) => toast.apiError(e),
          ),
      },
      {
        icon: <CalendarDays />,
        label: t("menu.submissions"),
        hint: f.submissionsCount,
        href: `/academic-requests?tab=all&formId=${f.id}`,
      },
    ],
    [
      f.status === "closed"
        ? {
            icon: <RotateCcw />,
            label: t("menu.reopen"),
            onSelect: () => void run(() => reopenForm(f.id), t("reopened")),
          }
        : {
            icon: <Ban />,
            label: t("menu.close"),
            disabled: f.status !== "published",
            onSelect: () => setClosing(f),
          },
      {
        icon: <Trash2 />,
        label: t("menu.delete"),
        danger: true,
        disabled: f.isDefault,
        onSelect: () => setDeleting(f),
      },
    ],
  ];

  const schema = z.object({
    nameEn: z.string().trim().min(2, t("new.nameMin")).max(160),
    nameAr: z.string().trim().min(2, t("new.nameMin")).max(160),
    slug: z
      .string()
      .trim()
      .max(80)
      .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, t("new.slugInvalid")),
  });

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: ta("title"), href: "/academic-requests" }, { label: t("title") }]}
        title={t("title")}
        subtitle={t("subtitle")}
        className="mb-3"
        actions={
          <Button icon={<Plus />} onClick={() => void setCreating("1")}>
            {t("newForm")}
          </Button>
        }
      />
      <AcademicTabs active="forms" />
      <DataList<FormRow>
        resource={formKeys.all}
        queryFn={(p) => listForms(formsQuery(p))}
        columns={columns}
        getRowId={(f) => f.id}
        tabs={FORM_TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
        tabCounts={(r) => (r as FormList).meta.counts as unknown as Record<string, number>}
        defaultTab="all"
        sortOptions={[
          { value: "updatedAt:desc", label: t("sort.updated") },
          { value: "nameEn:asc", label: t("sort.name") },
          { value: "submissionsCount:desc", label: t("sort.submissions") },
        ]}
        defaultSort="updatedAt:desc"
        searchPlaceholder={t("searchPlaceholder")}
        itemLabel={t("itemLabel")}
        onRowClick={(f) => router.push(builderHref(f))}
        rowMenuHeader={(f) => ({ title: name(f), subtitle: `/f/${f.slug}` })}
        rowMenu={rowMenu}
        emptyState={
          <EmptyState
            icon={<FileText />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={[
              <Button key="new" icon={<Plus />} onClick={() => void setCreating("1")}>
                {t("newForm")}
              </Button>,
            ]}
          />
        }
      />

      <FormDialog
        open={creating === "1"}
        onOpenChange={(o) => !o && void setCreating(null)}
        title={t("new.title")}
        description={t("new.description")}
        schema={schema}
        defaultValues={{ nameEn: "", nameAr: "", slug: "" }}
        submitLabel={t("new.submit")}
        fields={[
          { name: "nameEn", label: t("new.nameEn"), type: "text", required: true },
          { name: "nameAr", label: t("new.nameAr"), type: "text", required: true },
          {
            name: "slug",
            label: t("new.slug"),
            type: "text",
            placeholder: "event-request",
            hint: t("new.slugHint"),
          },
        ]}
        onSubmit={async (values) => {
          try {
            const form = await createForm({
              nameEn: values.nameEn,
              nameAr: values.nameAr,
              slug: values.slug || undefined,
            });
            invalidate();
            toast.success(t("new.done"));
            router.push(builderHref(form));
          } catch (e) {
            if (e instanceof ApiError && e.code === "SLUG_TAKEN") {
              throw new ApiError({
                status: 409,
                code: "VALIDATION_FAILED",
                message: e.message,
                details: [{ field: "slug", code: "SLUG_TAKEN", message: t("new.slugTaken") }],
              });
            }
            throw e;
          }
        }}
      />

      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        tone="warning"
        icon={<Ban />}
        title={t("closeDialog.title", { name: closing ? name(closing) : "" })}
        description={t("closeDialog.description")}
        impact={[t("closeDialog.impact1"), t("closeDialog.impact2")]}
        confirmLabel={t("closeDialog.submit")}
        onConfirm={async () => {
          await closeForm(closing!.id);
          toast.success(t("closed"));
          invalidate();
        }}
      />
      <DeleteFormDialog
        form={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDone={invalidate}
        onClose={(f) => setClosing(f)}
      />
    </>
  );
}

/** Delete; 409 FORM_HAS_SUBMISSIONS offers "Close form" instead. */
function DeleteFormDialog({
  form,
  onOpenChange,
  onDone,
  onClose,
}: {
  form: FormRow | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  onClose: (f: FormRow) => void;
}) {
  const t = useTranslations("academic.forms.deleteDialog");
  const locale = useLocale();
  const [hasSubmissions, setHasSubmissions] = useState(false);
  const blocked = hasSubmissions || (form?.submissionsCount ?? 0) > 0;
  return (
    <ConfirmDialog
      open={!!form}
      onOpenChange={(o) => {
        if (!o) setHasSubmissions(false);
        onOpenChange(o);
      }}
      tone="danger"
      icon={<Trash2 />}
      title={t("title", { name: form ? (locale === "ar" ? form.nameAr || form.nameEn : form.nameEn) : "" })}
      description={blocked ? t("hasSubmissions", { count: form?.submissionsCount ?? 0 }) : t("description")}
      impact={blocked ? undefined : [t("impact1"), t("impact2")]}
      confirmLabel={blocked ? t("closeInstead") : t("submit")}
      onConfirm={async () => {
        if (!form) return;
        if (blocked) {
          onClose(form);
          return;
        }
        try {
          await deleteForm(form.id);
          toast.success(t("done"));
          onDone();
        } catch (e) {
          if (e instanceof ApiError && e.code === "FORM_HAS_SUBMISSIONS") {
            setHasSubmissions(true);
            throw new Error(t("hasSubmissions", { count: form.submissionsCount }));
          }
          throw e;
        }
      }}
    />
  );
}
