"use client";

import { LayoutGrid, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormDialog } from "@/components/feedback/form-dialog";
import { toast } from "@/components/feedback/toast";
import { BilingualFields, type BilingualLang } from "@/components/forms/bilingual-fields";
import { Toggle } from "@/components/forms/fields";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type Category,
  type CategoryBody,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { CATEGORY_ICONS } from "./category-icons";

/* ------------------------------------------------------------------ CAT-02 add / edit */

const FIELD_MAP: Record<string, string> = {
  nameEn: "name_en",
  nameAr: "name_ar",
  descriptionEn: "description_en",
  descriptionAr: "description_ar",
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  focusLang,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → add */
  category: Category | null;
  /** Opens on this language and focuses its name (missing translation). */
  focusLang?: BilingualLang;
  onSaved?: (category: Category) => void;
}) {
  const t = useTranslations("categories");
  const schema = z
    .object({
      name_en: z.string().trim().max(120),
      name_ar: z.string().trim().max(120),
      description_en: z.string().trim().max(2000),
      description_ar: z.string().trim().max(2000),
      icon: z.string().min(1, t("iconRequired")),
      isVisible: z.boolean(),
    })
    .refine((v) => v.name_en || v.name_ar, { path: ["name_en"], message: t("nameRequired") });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title={category ? t("editTitle") : t("addTitle")}
      description={t("formDescription")}
      schema={schema}
      defaultValues={{
        name_en: category?.nameEn ?? "",
        name_ar: category?.nameAr ?? "",
        description_en: category?.descriptionEn ?? "",
        description_ar: category?.descriptionAr ?? "",
        icon: category?.icon ?? "",
        isVisible: category?.isVisible ?? true,
      }}
      submitLabel={category ? t("saveCategory") : t("addCategory")}
      fields={(form) => {
        const values = form.watch();
        const errors = form.formState.errors;
        return (
          <>
            <FocusLang lang={focusLang} />
            <BilingualFields
              defaultLang={focusLang ?? "en"}
              fields={[
                { name: "name", label: t("name"), maxLength: 120 },
                { name: "description", label: t("shortDescription"), required: false, maxLength: 2000 },
              ]}
              values={{
                name_en: values.name_en ?? "",
                name_ar: values.name_ar ?? "",
                description_en: values.description_en ?? "",
                description_ar: values.description_ar ?? "",
              }}
              errors={{
                name_en: errors.name_en?.message,
                name_ar: errors.name_ar?.message,
                description_en: errors.description_en?.message,
                description_ar: errors.description_ar?.message,
              }}
              onChange={(key, v) =>
                form.setValue(key as "name_en", v, {
                  shouldDirty: true,
                  shouldValidate: form.formState.isSubmitted,
                })
              }
            />
            <div role="radiogroup" aria-label={t("icon")} className="flex flex-col gap-1.5">
              <span className="text-13 font-medium text-ink">
                {t("icon")}
                <span aria-hidden className="ms-1 text-red">
                  *
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
                  const on = values.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={name}
                      title={name}
                      onClick={() => form.setValue("icon", name, { shouldDirty: true, shouldValidate: true })}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md border transition-colors [&_svg]:size-[18px]",
                        on
                          ? "border-brand bg-brand-soft text-brand ring-1 ring-brand"
                          : "border-border bg-surface text-ink-2 hover:bg-canvas",
                      )}
                    >
                      <Icon aria-hidden />
                    </button>
                  );
                })}
              </div>
              {errors.icon && (
                <p role="alert" className="text-12 text-red">
                  {errors.icon.message}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-14 font-medium text-ink">{t("showInApp")}</div>
                <div className="text-12 text-muted">{t("showInAppHint")}</div>
              </div>
              <Toggle
                aria-label={t("showInApp")}
                checked={!!values.isVisible}
                onCheckedChange={(v) => form.setValue("isVisible", v, { shouldDirty: true })}
              />
            </div>
          </>
        );
      }}
      onSubmit={async (v) => {
        const body: CategoryBody = {
          nameEn: v.name_en,
          nameAr: v.name_ar,
          descriptionEn: v.description_en || null,
          descriptionAr: v.description_ar || null,
          icon: v.icon,
          isVisible: v.isVisible,
        };
        try {
          const saved = category ? await updateCategory(category.id, body) : await createCategory(body);
          toast.success(
            category
              ? t("saved", { name: saved.nameEn || saved.nameAr })
              : t("added", { name: saved.nameEn || saved.nameAr }),
          );
          onSaved?.(saved);
        } catch (e) {
          if (e instanceof ApiError && e.code === "SLUG_TAKEN") {
            throw new ApiError({
              status: e.status,
              code: "VALIDATION_FAILED",
              message: e.message,
              details: [{ field: "name_en", code: e.code, message: t("slugTaken") }],
            });
          }
          if (e instanceof ApiError && e.fieldErrors.length > 0) {
            throw new ApiError({
              status: e.status,
              code: e.code,
              message: e.message,
              details: e.fieldErrors.map((f) => ({ ...f, field: FIELD_MAP[f.field] ?? f.field })),
            });
          }
          throw e;
        }
      }}
    />
  );
}

/** Focuses the name input of `lang` once the dialog has mounted. */
function FocusLang({ lang }: { lang?: BilingualLang }) {
  useEffect(() => {
    if (!lang) return;
    const id = setTimeout(() => {
      document.querySelector<HTMLInputElement>(`input[name="name_${lang}"]`)?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [lang]);
  return null;
}

/* ------------------------------------------------------------------ delete (+ move services) */

export function DeleteCategoryDialog({
  category,
  categories,
  onOpenChange,
  onDeleted,
}: {
  category: Category | null;
  /** All categories (move targets). */
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const [move, setMove] = useState<{ servicesCount: number; providersCount: number } | null>(null);
  const [lastId, setLastId] = useState(category?.id);
  if (category?.id !== lastId) {
    setLastId(category?.id);
    setMove(null);
  }
  const name = category ? category.nameEn || category.nameAr : "";

  if (!category) return null;

  if (move) {
    return (
      <ConfirmDialog
        key="move"
        open
        onOpenChange={(o) => {
          if (!o) {
            setMove(null);
            onOpenChange(false);
          }
        }}
        tone="danger"
        icon={<LayoutGrid />}
        title={t("moveTitle", { count: move.servicesCount, name })}
        description={t("moveDescription", { providers: move.providersCount })}
        reasonField={{
          label: t("moveTo"),
          required: true,
          requiredMessage: t("pickCategory"),
          options: categories
            .filter((c) => c.id !== category.id)
            .map((c) => ({ value: c.id, label: c.nameEn || c.nameAr })),
        }}
        confirmLabel={t("moveAndDelete")}
        footerNote={tc("savedInActivityLog")}
        onConfirm={async ({ reason }) => {
          await deleteCategory(category.id, reason);
          const target = categories.find((c) => c.id === reason);
          toast.success(t("deletedMoved", { name, target: target ? target.nameEn || target.nameAr : "" }));
          onDeleted?.();
        }}
      />
    );
  }

  return (
    <ConfirmDialog
      key="delete"
      open
      onOpenChange={onOpenChange}
      tone="danger"
      icon={<Trash2 />}
      title={t("deleteTitle", { name })}
      description={t("deleteDescription")}
      confirmLabel={t("delete")}
      footerNote={tc("savedInActivityLog")}
      onConfirm={async () => {
        try {
          await deleteCategory(category.id);
        } catch (e) {
          if (e instanceof ApiError && e.code === "CATEGORY_HAS_SERVICES") {
            const d = (e.details ?? {}) as { servicesCount?: number; providersCount?: number };
            setMove({
              servicesCount: d.servicesCount ?? category.servicesCount,
              providersCount: d.providersCount ?? category.providersCount,
            });
            // Keep the flow open: the move dialog replaces this one.
            throw new MoveRequired();
          }
          throw e;
        }
        toast.success(t("deleted", { name }));
        onDeleted?.();
      }}
    />
  );
}

class MoveRequired extends Error {
  constructor() {
    super("");
  }
}
