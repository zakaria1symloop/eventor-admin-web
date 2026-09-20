"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FileUp, MapPin, Pencil, Plus } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import {
  BilingualCell,
  CountLinkCell,
  DataList,
  ToggleCell,
  type DataColumn,
  type FilterConfig,
  type ListParams,
  type QuickFilterItem,
} from "@/components/data-list";
import { ExportDialog } from "@/components/feedback/export-dialog";
import { FormDialog } from "@/components/feedback/form-dialog";
import { toast } from "@/components/feedback/toast";
import { Field, Select, TextInput } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  createCommune,
  listWilayas,
  updateWilaya,
  WILAYA_REGIONS,
  wilayaKeys,
  type CountedList,
  type Wilaya,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";
import { savedViewsSource } from "@/lib/api/saved-views";
import { formatNumber } from "@/lib/utils/format";
import { ImportCommunesDialog } from "./import-communes-dialog";
import { closeDetails, CloseWilayaConfirm, WilayaDrawer } from "./wilaya-drawer";

const pad = (code: number) => String(code).padStart(2, "0");

export function LocationsScreen() {
  const t = useTranslations("locations");
  const tp = useTranslations("pages.locations");
  const tb = useTranslations("breadcrumb");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [wilayaParam, setWilayaParam] = useQueryState(
    "wilaya",
    parseAsString.withOptions({ history: "push" }),
  );
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<ListParams | null>(null);
  const [closing, setClosing] = useState<{
    wilaya: Wilaya;
    servicesCount: number;
    providersCount: number;
  } | null>(null);

  const all = useQuery({
    queryKey: [...wilayaKeys.all, "all"],
    queryFn: () => listWilayas({ limit: 100, sort: "code:asc" }),
  });
  const allRows = all.data?.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: wilayaKeys.all });
  const regionLabel = useCallback((r: string) => (t.has(`regions.${r}`) ? t(`regions.${r}`) : r), [t]);

  const columns = useMemo<DataColumn<Wilaya>[]>(
    () => [
      {
        id: "code",
        header: t("columns.wilaya"),
        sortable: true,
        hideable: false,
        cell: (w) => (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <MapPin className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-14 font-medium text-ink">
                <span dir="ltr">{pad(w.code)}</span> · {w.name}
              </span>
              <span className="block truncate text-12 text-muted">{regionLabel(w.region)}</span>
            </span>
          </div>
        ),
      },
      {
        id: "nameAr",
        header: t("columns.arabicName"),
        sortable: true,
        cell: (w) => (
          <BilingualCell ar={w.nameAr} onMissingClick={() => void setWilayaParam(String(w.code))} />
        ),
      },
      {
        id: "communesCount",
        header: t("columns.communes"),
        cell: (w) => (
          <span className="text-13 text-ink-2 tabular-nums">{formatNumber(w.communesCount, locale)}</span>
        ),
      },
      {
        id: "providersCount",
        header: t("columns.providers"),
        cell: (w) => (
          <CountLinkCell
            count={w.providersCount}
            href={`/users?tab=providers&wilaya=${w.code}`}
            label={(n) => formatNumber(n, locale)}
          />
        ),
      },
      {
        id: "servicesCount",
        header: t("columns.services"),
        cell: (w) => (
          <CountLinkCell
            count={w.servicesCount}
            href={`/services?wilaya=${w.code}`}
            label={(n) => formatNumber(n, locale)}
          />
        ),
      },
      {
        id: "clientsCount",
        header: t("columns.clients"),
        cell: (w) => (
          <CountLinkCell
            count={w.clientsCount}
            href={`/users?tab=clients&wilaya=${w.code}`}
            label={(n) => formatNumber(n, locale)}
          />
        ),
      },
      {
        id: "isOpen",
        header: t("columns.open"),
        cell: (w) => (
          <ToggleCell
            checked={w.isOpen}
            label={t("toggleLabel", { name: w.name })}
            onChange={async (next) => {
              try {
                await updateWilaya(w.code, { isOpen: next });
              } catch (e) {
                const d = closeDetails(e);
                if (!d) throw e;
                setClosing({ wilaya: w, ...d });
                return;
              }
              toast.success(next ? t("opened", { name: w.name }) : t("closed", { name: w.name }));
              void invalidate();
            }}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, regionLabel],
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        key: "region",
        label: t("filters.region"),
        multiple: true,
        options: WILAYA_REGIONS.map((r) => ({ value: r, label: regionLabel(r) })),
      },
      {
        key: "providers",
        label: t("filters.providers"),
        options: [
          { value: "with", label: t("filters.withProviders") },
          { value: "without", label: t("filters.withoutProviders") },
        ],
      },
    ],
    [t, regionLabel],
  );

  const openCount = allRows.filter((w) => w.isOpen).length;
  const communes = allRows.reduce((s, w) => s + w.communesCount, 0);
  const withProviders = allRows.filter((w) => w.providersCount > 0).length;
  const v = (n: number) => (all.data ? formatNumber(n, locale) : "—");
  const quickFilters: QuickFilterItem[] = [
    {
      key: "open",
      label: t("stats.open"),
      value: all.data ? t("stats.openValue", { open: openCount, total: allRows.length }) : "—",
      hint: t("stats.notOpen", { count: allRows.length - openCount }),
      tone: "green",
      filter: { providers: null, region: null },
    },
    {
      key: "communes",
      label: t("stats.communes"),
      value: v(communes),
      hint: t("stats.communesHint"),
      tone: "brand",
      filter: { providers: null },
    },
    {
      key: "withProviders",
      label: t("stats.withProviders"),
      value: v(withProviders),
      hint: t("stats.withProvidersHint"),
      tone: "blue",
      filter: { providers: "with" },
    },
    {
      key: "withoutProviders",
      label: t("stats.withoutProviders"),
      value: v(allRows.length - withProviders),
      hint: t("stats.withoutProvidersHint"),
      tone: "amber",
      filter: { providers: "without" },
    },
  ];

  const addSchema = z.object({
    wilayaCode: z.string().min(1, t("wilayaRequired")),
    name: z.string().trim().min(2, t("communeNamesRequired")).max(120),
    nameAr: z.string().trim().min(2, t("communeNamesRequired")).max(120),
    postalCode: z
      .string()
      .trim()
      .regex(/^(\d{5})?$/, t("postalInvalid")),
  });

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: tb("setup") }, { label: tp("title") }]}
        title={tp("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Button variant="secondary" icon={<FileText />} onClick={() => setExportOpen(true)}>
              {t("export")}
            </Button>
            <Button variant="secondary" icon={<FileUp />} onClick={() => setImportOpen(true)}>
              {t("importCommunes")}
            </Button>
            <Button icon={<Plus />} onClick={() => setAddOpen(true)}>
              {t("addCommune")}
            </Button>
          </>
        }
      />
      <DataList<Wilaya>
        resource={wilayaKeys.all}
        queryFn={async (p) => {
          const providers = p.filters.providers;
          const res = await listWilayas({
            tab: p.tab === "all" ? undefined : p.tab,
            q: p.q || undefined,
            region: p.filters.region,
            sort: p.sort || undefined,
            page: providers ? 1 : p.page,
            limit: providers ? 100 : p.limit,
          });
          if (!providers) return res;
          const data = res.data.filter((w) => (providers === "with") === w.providersCount > 0);
          return { data, meta: { ...res.meta, page: 1, total: data.length, totalPages: 1 } };
        }}
        columns={columns}
        getRowId={(w) => String(w.code)}
        tabs={[
          { key: "all", label: t("tabs.all") },
          { key: "open", label: t("tabs.open") },
          { key: "closed", label: t("tabs.closed") },
        ]}
        tabCounts={(r) => (r as CountedList<Wilaya>).meta.counts}
        defaultTab="all"
        filters={filters}
        quickFilters={quickFilters}
        sortOptions={[
          { value: "code:asc", label: t("sort.code") },
          { value: "name:asc", label: t("sort.name") },
          { value: "nameAr:asc", label: t("sort.nameAr") },
        ]}
        defaultSort="code:asc"
        defaultLimit={20}
        searchPlaceholder={t("searchPlaceholder")}
        savedViews={savedViewsSource("wilayas")}
        columnsStorageKey="wilayas"
        itemLabel={t("itemLabel")}
        onParamsChange={setParams}
        onRowClick={(w) => void setWilayaParam(String(w.code))}
        footer={() => t("footer")}
        rowMenuHeader={(w) => ({ title: `${pad(w.code)} · ${w.name}`, subtitle: regionLabel(w.region) })}
        rowMenu={(w) => [
          [{ icon: <Pencil />, label: t("manage"), onSelect: () => void setWilayaParam(String(w.code)) }],
        ]}
      />

      <WilayaDrawer
        code={wilayaParam}
        onClose={() => void setWilayaParam(null)}
        onImport={() => setImportOpen(true)}
      />
      <CloseWilayaConfirm
        pending={closing}
        name={closing?.wilaya.name ?? ""}
        onDone={async (ok) => {
          const c = closing;
          setClosing(null);
          if (!ok || !c) return;
          try {
            await updateWilaya(c.wilaya.code, { isOpen: false, confirm: true });
            toast.success(t("closed", { name: c.wilaya.name }));
          } catch (e) {
            toast.apiError(e);
          } finally {
            void invalidate();
          }
        }}
      />
      <ImportCommunesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void invalidate()}
      />
      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t("addCommuneTitle")}
        schema={addSchema}
        defaultValues={{ wilayaCode: wilayaParam ?? "", name: "", nameAr: "", postalCode: "" }}
        submitLabel={t("add")}
        width={480}
        fields={(form) => (
          <>
            <Field label={t("wilaya")} required error={form.formState.errors.wilayaCode?.message}>
              <Select
                {...form.register("wilayaCode")}
                placeholder={t("pickWilaya")}
                options={allRows.map((w) => ({ value: String(w.code), label: `${pad(w.code)} · ${w.name}` }))}
              />
            </Field>
            <Field label={t("communeName")} required error={form.formState.errors.name?.message}>
              <TextInput {...form.register("name")} />
            </Field>
            <Field label={t("communeNameAr")} required error={form.formState.errors.nameAr?.message}>
              <TextInput {...form.register("nameAr")} dir="rtl" lang="ar" className="font-arabic" />
            </Field>
            <Field label={t("postalCode")} error={form.formState.errors.postalCode?.message}>
              <TextInput {...form.register("postalCode")} dir="ltr" inputMode="numeric" maxLength={5} />
            </Field>
          </>
        )}
        onSubmit={async (values) => {
          try {
            await createCommune({
              wilayaCode: Number(values.wilayaCode),
              name: values.name,
              nameAr: values.nameAr,
              postalCode: values.postalCode || null,
            });
          } catch (e) {
            if (e instanceof ApiError && e.code === "COMMUNE_EXISTS") {
              throw new ApiError({
                status: e.status,
                code: "VALIDATION_FAILED",
                message: e.message,
                details: [
                  { field: "name", code: e.code, message: t("communeExists", { name: values.name }) },
                ],
              });
            }
            throw e;
          }
          toast.success(t("communeAdded", { name: values.name }));
          void invalidate();
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resource="wilayas"
        title={t("exportTitle")}
        filters={{
          ...(params?.tab && params.tab !== "all" ? { tab: params.tab } : {}),
          ...(params?.q ? { q: params.q } : {}),
          ...(params?.filters.region ? { region: params.filters.region } : {}),
        }}
        summary={t("exportSummary", {
          count: all.data?.meta.total ?? 0,
          tab: t(`tabs.${params?.tab || "all"}`),
        })}
        columns={[
          { key: "code", label: t("exportColumns.code") },
          { key: "name", label: t("exportColumns.name") },
          { key: "nameAr", label: t("exportColumns.nameAr") },
          { key: "region", label: t("exportColumns.region") },
          { key: "isOpen", label: t("exportColumns.isOpen") },
          { key: "communesCount", label: t("exportColumns.communesCount") },
          { key: "providersCount", label: t("exportColumns.providersCount") },
          { key: "servicesCount", label: t("exportColumns.servicesCount") },
          { key: "clientsCount", label: t("exportColumns.clientsCount") },
        ]}
      />
    </>
  );
}
