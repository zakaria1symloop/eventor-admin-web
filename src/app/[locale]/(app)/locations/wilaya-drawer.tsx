"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { DebouncedSearch, Pagination } from "@/components/data-list";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormDrawer } from "@/components/feedback/form-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { Field, TextInput, Toggle } from "@/components/forms/fields";
import { Button, IconButton } from "@/components/ui/button";
import {
  createCommune,
  deleteCommune,
  getWilaya,
  listCommunes,
  updateCommune,
  updateWilaya,
  wilayaKeys,
  type Commune,
  type Wilaya,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";

type CloseConfirm = { servicesCount: number; providersCount: number; resolve: (ok: boolean) => void } | null;

export function closeDetails(e: unknown): { servicesCount: number; providersCount: number } | null {
  if (!(e instanceof ApiError) || e.code !== "WILAYA_CLOSE_CONFIRM_REQUIRED") return null;
  const d = (e.details ?? {}) as { servicesCount?: number; providersCount?: number };
  return { servicesCount: d.servicesCount ?? 0, providersCount: d.providersCount ?? 0 };
}

/** LOC-02 — wilaya drawer (`?wilaya=16`): open toggle, names, communes with inline edit and import. */
export function WilayaDrawer({
  code,
  onClose,
  onImport,
}: {
  code: string | null;
  onClose: () => void;
  onImport: () => void;
}) {
  const t = useTranslations("locations");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [confirmClose, setConfirmClose] = useState<CloseConfirm>(null);

  const wilaya = useQuery({
    queryKey: wilayaKeys.detail(code ?? ""),
    queryFn: () => getWilaya(code!),
    enabled: !!code,
  });
  const w = wilaya.data;

  const schema = z.object({
    isOpen: z.boolean(),
    name: z.string().trim().min(2, t("nameRequired")).max(80),
    nameAr: z.string().trim().min(2, t("nameRequired")).max(80),
  });

  const askClose = (d: { servicesCount: number; providersCount: number }) =>
    new Promise<boolean>((resolve) => setConfirmClose({ ...d, resolve }));

  return (
    <>
      <FormDrawer
        open={!!code && !!w}
        onOpenChange={(o) => !o && onClose()}
        width={500}
        title={w ? `${String(w.code).padStart(2, "0")} · ${w.name}` : t("wilaya")}
        description={
          w ? (
            <>
              {t("drawerMeta", { communes: w.communesCount, providers: w.providersCount })} ·{" "}
              <span lang="ar" dir="rtl" className="font-arabic">
                {w.nameAr}
              </span>
            </>
          ) : undefined
        }
        schema={schema}
        defaultValues={{ isOpen: w?.isOpen ?? true, name: w?.name ?? "", nameAr: w?.nameAr ?? "" }}
        submitLabel={tc("save")}
        fields={(form) => {
          const v = form.watch();
          const errors = form.formState.errors;
          return (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
                <div>
                  <div className="text-14 font-medium text-ink">{t("openInApp")}</div>
                  <div className="text-12 text-muted">
                    {v.isOpen ? t("closingHides", { count: w?.servicesCount ?? 0 }) : t("closedHint")}
                  </div>
                </div>
                <Toggle
                  aria-label={t("openInApp")}
                  checked={!!v.isOpen}
                  onCheckedChange={(on) => form.setValue("isOpen", on, { shouldDirty: true })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("nameEn")} required error={errors.name?.message}>
                  <TextInput {...form.register("name")} />
                </Field>
                <Field label={t("nameAr")} required error={errors.nameAr?.message}>
                  <TextInput {...form.register("nameAr")} dir="rtl" lang="ar" className="font-arabic" />
                </Field>
              </div>
              {w && <CommunesSection wilaya={w} onImport={onImport} />}
            </>
          );
        }}
        onSubmit={async (values) => {
          if (!w) return;
          const body: { isOpen?: boolean; name?: string; nameAr?: string; confirm?: boolean } = {};
          if (values.isOpen !== w.isOpen) body.isOpen = values.isOpen;
          if (values.name !== w.name) body.name = values.name;
          if (values.nameAr !== w.nameAr) body.nameAr = values.nameAr;
          if (Object.keys(body).length === 0) return;
          try {
            await updateWilaya(w.code, body);
          } catch (e) {
            const d = closeDetails(e);
            if (!d) throw e;
            if (!(await askClose(d))) throw new Error(t("closeCancelled"));
            await updateWilaya(w.code, { ...body, confirm: true });
          }
          toast.success(t("wilayaSaved", { name: values.name }));
          void queryClient.invalidateQueries({ queryKey: wilayaKeys.all });
        }}
      />
      {wilaya.isError && code && <WilayaLoadError error={wilaya.error} onClose={onClose} />}
      <CloseWilayaConfirm
        pending={confirmClose}
        name={w?.name ?? ""}
        onDone={(ok) => {
          confirmClose?.resolve(ok);
          setConfirmClose(null);
        }}
      />
    </>
  );
}

function WilayaLoadError({ error, onClose }: { error: unknown; onClose: () => void }) {
  useEffect(() => {
    toast.apiError(error);
    onClose();
  }, [error, onClose]);
  return null;
}

export function CloseWilayaConfirm({
  pending,
  name,
  onDone,
}: {
  pending: { servicesCount: number; providersCount: number } | null;
  name: string;
  onDone: (ok: boolean) => void;
}) {
  const t = useTranslations("locations");
  const tc = useTranslations("common");
  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(o) => !o && onDone(false)}
      tone="warning"
      title={t("closeTitle", { name })}
      description={t("closeDescription")}
      impact={[
        t("closeImpactServices", { count: pending?.servicesCount ?? 0 }),
        t("closeImpactProviders", { count: pending?.providersCount ?? 0 }),
        t("closeImpactBookings"),
      ]}
      confirmLabel={t("closeConfirm")}
      footerNote={tc("savedInActivityLog")}
      onConfirm={() => onDone(true)}
    />
  );
}

/* ------------------------------------------------------------------ communes */

type Editing = {
  id: string | "new";
  name: string;
  nameAr: string;
  postalCode: string;
  error?: string;
} | null;

function CommunesSection({ wilaya, onImport }: { wilaya: Wilaya; onImport: () => void }) {
  const t = useTranslations("locations");
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Commune | null>(null);
  const limit = 20;

  const communes = useQuery({
    queryKey: [...wilayaKeys.communes(wilaya.code), { q, page }],
    queryFn: () => listCommunes(wilaya.code, { q: q || undefined, page, limit }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: wilayaKeys.communes(wilaya.code) });
    void queryClient.invalidateQueries({ queryKey: wilayaKeys.all });
  };

  async function save() {
    if (!editing) return;
    const body = {
      name: editing.name.trim(),
      nameAr: editing.nameAr.trim(),
      postalCode: editing.postalCode.trim() || null,
    };
    if (!body.name || !body.nameAr) return setEditing({ ...editing, error: t("communeNamesRequired") });
    if (body.postalCode && !/^\d{5}$/.test(body.postalCode))
      return setEditing({ ...editing, error: t("postalInvalid") });
    setSaving(true);
    try {
      if (editing.id === "new") await createCommune({ ...body, wilayaCode: wilaya.code });
      else await updateCommune(editing.id, body);
      toast.success(
        editing.id === "new"
          ? t("communeAdded", { name: body.name })
          : t("communeSaved", { name: body.name }),
      );
      setEditing(null);
      refresh();
    } catch (e) {
      const msg =
        e instanceof ApiError && e.code === "COMMUNE_EXISTS"
          ? t("communeExists", { name: body.name })
          : e instanceof ApiError && e.fieldErrors.length
            ? e.fieldErrors.map((f) => f.message).join(" · ")
            : e instanceof Error
              ? e.message
              : String(e);
      setEditing({ ...editing, error: msg });
    } finally {
      setSaving(false);
    }
  }

  const editor = (e: NonNullable<Editing>) => (
    <li className="flex flex-col gap-2 bg-brand-soft/40 px-3 py-2.5">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_90px]">
        <TextInput
          aria-label={t("communeName")}
          placeholder={t("communeName")}
          value={e.name}
          autoFocus
          onChange={(ev) => setEditing({ ...e, name: ev.target.value, error: undefined })}
          onKeyDown={(ev) => ev.key === "Enter" && (ev.preventDefault(), void save())}
        />
        <TextInput
          aria-label={t("communeNameAr")}
          placeholder={t("communeNameAr")}
          dir="rtl"
          lang="ar"
          className="font-arabic"
          value={e.nameAr}
          onChange={(ev) => setEditing({ ...e, nameAr: ev.target.value, error: undefined })}
          onKeyDown={(ev) => ev.key === "Enter" && (ev.preventDefault(), void save())}
        />
        <TextInput
          aria-label={t("postalCode")}
          placeholder={t("postalCode")}
          dir="ltr"
          inputMode="numeric"
          maxLength={5}
          value={e.postalCode}
          onChange={(ev) => setEditing({ ...e, postalCode: ev.target.value, error: undefined })}
          onKeyDown={(ev) => ev.key === "Enter" && (ev.preventDefault(), void save())}
        />
      </div>
      <div className="flex items-center gap-2">
        {e.error && (
          <p role="alert" className="me-auto text-12 text-red">
            {e.error}
          </p>
        )}
        <span className="me-auto" />
        <Button size="sm" variant="secondary" icon={<X />} onClick={() => setEditing(null)} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button size="sm" icon={<Check />} loading={saving} onClick={() => void save()}>
          {e.id === "new" ? t("add") : t("saveCommune")}
        </Button>
      </div>
    </li>
  );

  const rows = communes.data?.data ?? [];

  return (
    <section className="flex flex-col gap-3" aria-labelledby="communes-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="communes-title" className="text-15 font-semibold text-ink">
          {t("communes")}
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="text-brand" onClick={onImport}>
            {t("importCommunes")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus />}
            onClick={() => setEditing({ id: "new", name: "", nameAr: "", postalCode: "" })}
          >
            {t("addCommune")}
          </Button>
        </div>
      </div>
      <DebouncedSearch
        className="sm:w-full"
        value={q}
        placeholder={t("searchCommunes")}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
      />
      <div className="overflow-hidden rounded-lg border border-border">
        {communes.isPending ? (
          <TableSkeleton rows={4} columns={2} />
        ) : communes.isError ? (
          <ErrorState error={communes.error} onRetry={() => void communes.refetch()} />
        ) : (
          <ul className="divide-y divide-border">
            {editing?.id === "new" && editor(editing)}
            {rows.length === 0 && editing?.id !== "new" && (
              <li>
                <EmptyState
                  className="py-8"
                  title={q ? t("noCommunesMatch") : t("noCommunes")}
                  actions={
                    q
                      ? [
                          <Button key="clear" variant="secondary" onClick={() => setQ("")}>
                            {t("clearSearch")}
                          </Button>,
                        ]
                      : undefined
                  }
                />
              </li>
            )}
            {rows.map((c) =>
              editing?.id === c.id ? (
                <Fragment key={c.id}>{editor(editing)}</Fragment>
              ) : (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-13">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{c.name}</span>
                    {c.postalCode && (
                      <span className="block text-12 text-muted" dir="ltr">
                        {c.postalCode}
                      </span>
                    )}
                  </span>
                  <span lang="ar" dir="rtl" className="truncate font-arabic text-ink-2">
                    {c.nameAr}
                  </span>
                  {c.bookingsCount !== undefined && c.bookingsCount > 0 && (
                    <span className="text-12 whitespace-nowrap text-brand">
                      {t("bookingsCount", { count: c.bookingsCount })}
                    </span>
                  )}
                  <IconButton
                    size="sm"
                    label={t("editCommune", { name: c.name })}
                    onClick={() =>
                      setEditing({ id: c.id, name: c.name, nameAr: c.nameAr, postalCode: c.postalCode ?? "" })
                    }
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={t("deleteCommune", { name: c.name })}
                    className="hover:text-red"
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              ),
            )}
          </ul>
        )}
        {communes.data && communes.data.meta.total > limit && (
          <div className="border-t border-border">
            <Pagination
              page={page}
              limit={limit}
              total={communes.data.meta.total}
              onPageChange={setPage}
              onLimitChange={() => undefined}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        tone="danger"
        icon={<Trash2 />}
        title={t("deleteCommuneTitle", { name: deleting?.name ?? "" })}
        description={t("deleteCommuneDescription")}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteCommune(deleting.id);
          } catch (e) {
            if (e instanceof ApiError && e.code === "COMMUNE_IN_USE") throw new Error(t("communeInUse"));
            throw e;
          }
          toast.success(t("communeDeleted", { name: deleting.name }));
          refresh();
        }}
      />
    </section>
  );
}
