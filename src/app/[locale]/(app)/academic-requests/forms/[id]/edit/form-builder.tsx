"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  Eye,
  FileUp,
  GripVertical,
  Hash,
  Heading,
  Info,
  LayoutGrid,
  Loader2,
  Mail,
  MapPin,
  Phone,
  SearchX,
  Trash2,
  Type,
  Wallet,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { NextIntlClientProvider as NextIntlScope, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FormRenderer, type FormFiles } from "@/components/domain/form-renderer";
import { Banner } from "@/components/feedback/banner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DialogRoot, DrawerContent } from "@/components/feedback/dialog";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { toast } from "@/components/feedback/toast";
import { UnsavedChangesGuard } from "@/components/feedback/unsaved-changes-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Pill, Count } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  formKeys,
  getForm,
  getFormVersion,
  publishForm,
  saveFormDraft,
  type FormDetail,
} from "@/lib/api/forms";
import {
  PALETTE,
  addField,
  fieldLabel,
  isDisplay,
  issuesByField,
  missingMappings,
  missingTranslations,
  moveField,
  newField,
  removeField,
  schemaIssues,
  toSchema,
  updateField,
  type FieldType,
  type FormField,
  type FormSchema,
  type SchemaIssue,
} from "@/lib/forms/schema";
import { algiersToday } from "@/lib/forms/validate";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { FieldSettings, FormSettingsCard, useIssueText, VersionsCard } from "./builder-panels";

export const fieldTypeIcon: Record<FieldType, ReactNode> = {
  short_text: <Type />,
  long_text: <AlignLeft />,
  number: <Hash />,
  email: <Mail />,
  phone: <Phone />,
  single_choice: <CircleDot />,
  multi_choice: <CheckSquare />,
  dropdown: <ChevronDown />,
  date: <Calendar />,
  time_range: <Clock />,
  wilaya: <MapPin />,
  service_categories: <LayoutGrid />,
  budget_range: <Wallet />,
  file: <FileUp />,
  section: <Heading />,
  info: <Info />,
  consent: <Check />,
};

const AUTOSAVE_MS = 1200;
type SaveState = { kind: "idle" | "saving" | "saved" | "error"; at?: string; message?: string };

export function FormBuilderScreen({ id }: { id: string }) {
  const t = useTranslations("academic.builder");
  const ta = useTranslations("academic");
  const router = useRouter();
  const query = useQuery({ queryKey: formKeys.detail(id), queryFn: () => getForm(id) });
  const liveVersionId = query.data?.liveVersion?.id;
  // A form without a draft edits a copy of its live version.
  const live = useQuery({
    queryKey: formKeys.version(id, liveVersionId ?? ""),
    queryFn: () => getFormVersion(id, liveVersionId!),
    enabled: !!query.data && !query.data.draftSchema && !!liveVersionId,
    staleTime: Infinity,
  });

  if (query.isPending || (query.data && !query.data.draftSchema && liveVersionId && live.isPending)) {
    return (
      <div className="grid gap-4 lg:grid-cols-[230px_1fr_340px]" aria-busy="true">
        <CardSkeleton className="h-[600px]" />
        <CardSkeleton className="h-[600px]" />
        <CardSkeleton className="h-[600px]" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader
          back
          breadcrumb={[{ label: ta("forms.title"), href: "/academic-requests/forms" }, { label: "—" }]}
        />
        <Card>
          {notFound ? (
            <EmptyState
              icon={<SearchX />}
              title={t("notFoundTitle")}
              actions={[
                <Button key="b" variant="secondary" onClick={() => router.push("/academic-requests/forms")}>
                  {t("back")}
                </Button>,
              ]}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </>
    );
  }
  const initial = toSchema(query.data.draftSchema ?? live.data?.schema);
  return <Builder key={query.data.id} form={query.data} initialSchema={initial} />;
}

function Builder({ form: loaded, initialSchema }: { form: FormDetail; initialSchema: FormSchema }) {
  const t = useTranslations("academic.builder");
  const ta = useTranslations("academic");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const issueText = useIssueText();
  const [form, setForm] = useState(loaded);
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [selected, setSelected] = useState<string | null>(
    initialSchema.fields.find((f) => !isDisplay(f.type))?.key ?? null,
  );
  const [lang, setLang] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");
  const [panel, setPanel] = useState<"field" | "form">("field");
  const [serverIssues, setServerIssues] = useState<SchemaIssue[]>([]);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [dirty, setDirty] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [preview, setPreview] = useQueryState("preview", parseAsString.withOptions({ history: "replace" }));
  const [viewVersion, setViewVersion] = useState<string | null>(null);
  const updatedAt = useRef(form.updatedAt);
  const latest = useRef(schema);
  useEffect(() => {
    latest.current = schema;
  }, [schema]);

  const localIssues = useMemo(() => schemaIssues(schema), [schema]);
  const issues = serverIssues.length ? serverIssues : localIssues;
  const byField = useMemo(() => issuesByField(schema, issues), [schema, issues]);
  const missingEn = missingTranslations(schema, "en").length;
  const missingAr = missingTranslations(schema, "ar").length;
  const mappingsMissing = missingMappings(schema);
  const liveVersion = form.liveVersion?.version ?? 0;
  const selectedField = schema.fields.find((f) => f.key === selected) ?? null;

  const apply = (next: FormDetail) => {
    setForm(next);
    updatedAt.current = next.updatedAt;
    queryClient.setQueryData(formKeys.detail(next.id), next);
    void queryClient.invalidateQueries({ queryKey: [...formKeys.all, "list"] });
  };

  /* ---------------- autosave */

  const saveNow = useCallback(
    async (s: FormSchema) => {
      setSave({ kind: "saving" });
      try {
        const next = await saveFormDraft(form.id, {
          schema: s as unknown as Record<string, unknown>,
          updatedAt: updatedAt.current,
        });
        apply(next);
        setServerIssues([]);
        // Edits made while saving stay dirty (the effect saves them next).
        if (latest.current === s) setDirty(false);
        setSave({ kind: "saved", at: next.updatedAt });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.code === "FORM_SCHEMA_INVALID" && Array.isArray(e.details)) {
          setServerIssues(e.details as SchemaIssue[]);
          setSave({ kind: "error", message: t("saveInvalid", { count: (e.details as unknown[]).length }) });
        } else if (e instanceof ApiError && e.code === "STALE_UPDATE") {
          setSave({ kind: "error", message: t("stale") });
        } else setSave({ kind: "error", message: e instanceof Error ? e.message : String(e) });
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.id],
  );

  useEffect(() => {
    if (!dirty) return;
    // Structural problems the API would refuse: wait until they are fixed.
    if (localIssues.some((i) => !["MAPPING_REQUIRED"].includes(i.code))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSave({ kind: "error", message: t("fixToSave", { count: localIssues.length }) });
      return;
    }
    const timer = setTimeout(() => void saveNow(schema), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [schema, dirty, localIssues, saveNow, t]);

  const change = (next: FormSchema) => {
    setSchema(next);
    setDirty(true);
    setServerIssues([]);
  };

  /* ---------------- edits */

  const add = (type: FieldType, index?: number) => {
    const field = newField(schema, type);
    const at =
      index ?? (selected ? schema.fields.findIndex((f) => f.key === selected) + 1 : schema.fields.length);
    change(addField(schema, field, at));
    setSelected(field.key);
    setPanel("field");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragging, setDragging] = useState<
    { kind: "palette"; type: FieldType } | { kind: "field"; key: string } | null
  >(null);
  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as
      { kind: "palette"; type: FieldType } | { kind: "field"; key: string } | undefined;
    setDragging(data ?? null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const data = e.active.data.current as
      { kind: "palette"; type: FieldType } | { kind: "field"; key: string } | undefined;
    if (!data || !e.over) return;
    const overKey = String(e.over.id);
    const overIndex =
      overKey === "canvas-end" ? schema.fields.length : schema.fields.findIndex((f) => f.key === overKey);
    if (data.kind === "palette") {
      add(data.type, overIndex < 0 ? schema.fields.length : overIndex);
      return;
    }
    const from = schema.fields.findIndex((f) => f.key === data.key);
    const to = overKey === "canvas-end" ? schema.fields.length - 1 : overIndex;
    if (from >= 0 && to >= 0 && from !== to) change(moveField(schema, from, to));
  };

  /* ---------------- publish */

  async function publish() {
    if (dirty && !(await saveNow(schema))) throw new Error(save.message ?? t("saveFirst"));
    try {
      const next = await publishForm(form.id);
      apply(next);
      toast.success(t("published", { version: next.liveVersion?.version ?? liveVersion + 1 }));
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.code === "FORM_TRANSLATION_MISSING" || e.code === "FORM_SCHEMA_INVALID") &&
        Array.isArray(e.details)
      ) {
        const list = e.details as SchemaIssue[];
        setServerIssues(list);
        const firstField = issuesByField(schema, list);
        const key = Object.keys(firstField)[0];
        if (key) {
          setSelected(key);
          setPanel("field");
        }
        if (list.some((i) => i.path.endsWith("label_ar"))) setLang("ar");
        throw new Error(
          e.code === "FORM_TRANSLATION_MISSING"
            ? t("translationsMissing", { count: list.length })
            : t("schemaInvalid", { count: list.length }),
        );
      }
      throw e;
    }
  }

  const pendingSave = dirty || save.kind === "saving";
  const name = locale === "ar" ? form.nameAr || form.nameEn : form.nameEn;

  return (
    <UnsavedChangesGuard when={pendingSave}>
      <PageHeader
        back
        breadcrumb={[
          { label: ta("title"), href: "/academic-requests" },
          { label: ta("forms.title"), href: "/academic-requests/forms" },
          { label: name },
        ]}
        className="mb-3"
      />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-26 font-semibold text-ink">{name}</h1>
            {form.liveVersion ? (
              <Pill tone="green">{t("liveVersion", { version: liveVersion })}</Pill>
            ) : (
              <StatusBadge domain="form" status={form.status} />
            )}
            {(form.hasDraftChanges || dirty) && (
              <Pill tone="amber">{t("draftVersion", { version: liveVersion + 1 })}</Pill>
            )}
            <SaveIndicator state={save} dirty={dirty} />
          </div>
          <p className="mt-1 text-14 text-muted">
            {[
              `/f/${form.slug}`,
              form.isDefault ? t("defaultForm") : null,
              t("submissions", { count: form.submissionsCount }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={<Eye />} onClick={() => void setPreview("1")}>
            {t("preview")}
          </Button>
          <Button
            variant="secondary"
            loading={save.kind === "saving"}
            disabled={!dirty}
            onClick={() => void saveNow(schema)}
          >
            {t("saveDraft")}
          </Button>
          <Button icon={<Check />} disabled={form.status === "closed"} onClick={() => setPublishOpen(true)}>
            {t("publish", { version: liveVersion + 1 })}
          </Button>
        </div>
      </div>

      {form.status === "closed" && <Banner tone="amber" className="mb-4" title={t("closedBanner")} />}
      {mappingsMissing.length > 0 && (
        <Banner
          tone="blue"
          className="mb-4"
          title={t("mappingsMissing", { count: mappingsMissing.length })}
          description={mappingsMissing.map((m) => t(`mapping.targets.${m}`)).join(", ")}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
          <Palette onAdd={(type) => add(type)} />

          <section aria-label={t("canvas")} className="flex min-w-0 flex-col gap-3">
            <div
              role="tablist"
              aria-label={t("language")}
              className="grid grid-cols-2 gap-1 rounded-lg bg-gray-soft p-1"
            >
              {(["en", "ar"] as const).map((l) => {
                const missing = l === "en" ? missingEn : missingAr;
                return (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={lang === l}
                    lang={l}
                    onClick={() => setLang(l)}
                    className={cn(
                      "flex h-9 items-center justify-center gap-2 rounded-md text-14",
                      lang === l ? "bg-surface font-medium text-brand shadow-sm" : "text-ink-2",
                    )}
                  >
                    {l === "en" ? "English" : "العربية"}
                    {missing > 0 && <Count tone="red">{t("missing", { count: missing })}</Count>}
                  </button>
                );
              })}
            </div>
            <SortableContext items={schema.fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2.5" dir={lang === "ar" ? "rtl" : "ltr"}>
                {schema.fields.map((f) => (
                  <CanvasField
                    key={f.key}
                    field={f}
                    schema={schema}
                    lang={lang}
                    selected={f.key === selected}
                    issues={byField[f.key]}
                    onSelect={() => {
                      setSelected(f.key);
                      setPanel("field");
                    }}
                    onRemove={() => {
                      change(removeField(schema, f.key));
                      if (selected === f.key) setSelected(null);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
            <DropZone active={dragging?.kind === "palette"} />
          </section>

          <aside className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-soft p-1">
              {(["field", "form"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={panel === p}
                  onClick={() => setPanel(p)}
                  className={cn(
                    "h-8 rounded-md text-13",
                    panel === p ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2",
                  )}
                >
                  {t(`panels.${p}`)}
                </button>
              ))}
            </div>
            {panel === "field" ? (
              selectedField ? (
                <FieldSettings
                  key={selectedField.key}
                  schema={schema}
                  field={selectedField}
                  issues={byField[selectedField.key] ?? []}
                  onChange={(patch) => {
                    change(updateField(schema, selectedField.key, patch));
                    if (patch.key) setSelected(patch.key);
                  }}
                  onRemove={() => {
                    change(removeField(schema, selectedField.key));
                    setSelected(null);
                  }}
                />
              ) : (
                <Card className="px-[18px] py-6 text-center text-13 text-muted">{t("selectField")}</Card>
              )
            ) : (
              <>
                <FormSettingsCard form={form} onSaved={apply} />
                <VersionsCard form={form} onView={setViewVersion} />
              </>
            )}
            {issues.filter((i) => !byField[schema.fields[Number(/\d+/.exec(i.path)?.[0] ?? -1)]?.key ?? ""])
              .length > 0 && (
              <Banner
                tone="red"
                title={t("formIssues")}
                description={issues
                  .filter((i) => !/^fields\[\d+\]/.test(i.path))
                  .map(issueText)
                  .join(" · ")}
              />
            )}
          </aside>
        </div>
        <DragOverlay>
          {dragging?.kind === "palette" ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-brand bg-surface px-3 text-13 shadow-overlay [&_svg]:size-4">
              {fieldTypeIcon[dragging.type]} {t(`types.${dragging.type}`)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        tone="success"
        icon={<Check />}
        title={t("publishTitle", { version: liveVersion + 1 })}
        description={t("publishDescription")}
        impact={[
          form.liveVersion
            ? t("publishImpactExisting", { count: form.submissionsCount, version: liveVersion })
            : t("publishImpactFirst"),
          t("publishImpactNew", { version: liveVersion + 1 }),
          ...(missingEn + missingAr > 0
            ? [t("publishImpactTranslations", { count: missingEn + missingAr })]
            : []),
        ]}
        confirmLabel={t("publish", { version: liveVersion + 1 })}
        onConfirm={publish}
      />

      <PreviewDrawer
        title={t("previewTitle", { name })}
        open={preview === "1"}
        onOpenChange={(o) => !o && void setPreview(null)}
        schema={schema}
      />
      <VersionDrawer formId={form.id} versionId={viewVersion} onClose={() => setViewVersion(null)} />
    </UnsavedChangesGuard>
  );
}

/* ------------------------------------------------------------------ pieces */

function SaveIndicator({ state, dirty }: { state: SaveState; dirty: boolean }) {
  const t = useTranslations("academic.builder");
  const locale = useLocale();
  if (state.kind === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-12 text-muted" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> {t("saving")}
      </span>
    );
  if (state.kind === "error")
    return (
      <span className="text-12 font-medium text-red" role="alert">
        {state.message}
      </span>
    );
  if (dirty) return <span className="text-12 text-amber">{t("unsaved")}</span>;
  if (state.kind === "saved" && state.at)
    return (
      <span className="text-12 text-green" aria-live="polite">
        {t("savedAt", { time: formatDateTime(state.at, locale) })}
      </span>
    );
  return null;
}

function Palette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  const t = useTranslations("academic.builder");
  return (
    <Card className="px-3.5 py-4 lg:sticky lg:top-[calc(var(--topbar-height)+16px)]">
      <h2 className="text-15 font-semibold text-ink">{t("addField")}</h2>
      <p className="mb-2 text-12 text-muted">{t("addFieldHint")}</p>
      {PALETTE.map((g) => (
        <div key={g.group} className="mt-3">
          <div className="mb-1.5 text-11 font-medium tracking-wide text-muted uppercase">
            {t(`groups.${g.group}`)}
          </div>
          <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {g.types.map((type) => (
              <PaletteItem key={type} type={type} onAdd={() => onAdd(type)} />
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

function PaletteItem({ type, onAdd }: { type: FieldType; onAdd: () => void }) {
  const t = useTranslations("academic.builder");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { kind: "palette", type },
  });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        onClick={onAdd}
        aria-label={t("addType", { type: t(`types.${type}`) })}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-start text-13 text-ink hover:border-brand/40 hover:bg-canvas [&_svg]:size-4 [&_svg]:text-ink-2",
          isDragging && "opacity-50",
        )}
      >
        {fieldTypeIcon[type]}
        <span className="truncate">{t(`types.${type}`)}</span>
      </button>
    </li>
  );
}

function DropZone({ active }: { active: boolean }) {
  const t = useTranslations("academic.builder");
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-12 items-center justify-center rounded-lg border border-dashed text-13 font-medium",
        isOver || active ? "border-brand bg-brand-soft text-brand" : "border-brand/40 text-brand",
      )}
    >
      {t("dropHere")}
    </div>
  );
}

function CanvasField({
  field: f,
  schema,
  lang,
  selected,
  issues,
  onSelect,
  onRemove,
}: {
  field: FormField;
  schema: FormSchema;
  lang: "en" | "ar";
  selected: boolean;
  issues?: SchemaIssue[];
  onSelect: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("academic.builder");
  const issueText = useIssueText();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.key,
    data: { kind: "field", key: f.key },
  });
  const label = lang === "ar" ? f.label_ar : f.label_en;
  const other = lang === "ar" ? f.label_en : f.label_ar;
  const target = f.showIf ? schema.fields.find((x) => x.key === f.showIf!.field) : undefined;
  const condition = f.showIf
    ? t("shownIf", {
        field: target ? fieldLabel(target, lang) || target.key : f.showIf.field,
        value: f.showIf.notEmpty
          ? t("showIf.operators.notEmpty")
          : String(
              f.showIf.in?.join(", ") ??
                target?.options?.find((o) => o.value === f.showIf!.equals)?.[
                  lang === "ar" ? "label_ar" : "label_en"
                ] ??
                f.showIf.equals,
            ),
      })
    : null;
  const summary = [
    t(`types.${f.type}`),
    f.options ? t("optionsCount", { count: f.options.length }) : null,
    f.validation?.maxLength ? t("maxChars", { count: f.validation.maxLength }) : null,
    f.validation?.minOffsetDays !== undefined ? t("minDays", { count: f.validation.minOffsetDays }) : null,
    f.type === "file"
      ? `${(f.validation?.types ?? ["pdf", "jpg", "png"]).join("/").toUpperCase()} · ${t("maxFiles", { count: f.validation?.maxFiles ?? 1 })}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const style = { transform: CSS.Transform.toString(transform), transition };
  if (f.type === "section") {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className={cn("group flex items-center gap-2 pt-2", isDragging && "opacity-50")}
        data-testid="canvas-field"
        data-key={f.key}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("drag", { name: label || f.key })}
          className="cursor-grab text-faint hover:text-ink-2"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "min-w-0 flex-1 truncate text-start text-12 font-semibold tracking-wide text-gold uppercase",
            selected && "underline",
          )}
        >
          {t("section")} · {label || <span className="text-red normal-case">{t("labelMissing")}</span>}
        </button>
        {issues?.length ? <Pill tone="red">{issues.length}</Pill> : null}
        <IconButton
          label={t("removeField")}
          size="sm"
          className="opacity-0 group-hover:opacity-100 focus:opacity-100"
          onClick={onRemove}
        >
          <Trash2 />
        </IconButton>
      </li>
    );
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="canvas-field"
      data-key={f.key}
      className={cn(
        "group flex items-start gap-2 rounded-lg border bg-surface px-3 py-3",
        selected ? "border-brand/50 bg-brand-soft/40 ring-1 ring-brand/30" : "border-border",
        issues?.length && !selected && "border-red/40",
        isDragging && "z-10 opacity-60 shadow-overlay",
        f.showIf && "ms-4",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("drag", { name: label || f.key })}
        className="mt-0.5 cursor-grab text-faint hover:text-ink-2"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-start" aria-pressed={selected}>
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("text-14 font-medium", label ? "text-ink" : "text-red")} lang={lang}>
            {label || (other ? t("translationMissing") : t("labelMissing"))}
          </span>
          {f.required && (
            <span className="text-red" aria-label={t("required")}>
              *
            </span>
          )}
          {f.maps_to && <Pill tone="brand">{t("mapped", { target: f.maps_to })}</Pill>}
          {condition && <Pill tone="amber">{condition}</Pill>}
        </span>
        <span className="mt-0.5 block truncate text-12 text-muted" dir="ltr">
          {summary}
        </span>
        {issues?.length ? <span className="mt-1 block text-12 text-red">{issueText(issues[0])}</span> : null}
      </button>
      <IconButton label={t("removeField")} size="sm" onClick={onRemove}>
        <Trash2 />
      </IconButton>
      {fieldTypeIcon[f.type] && <span className="sr-only">{f.type}</span>}
    </li>
  );
}

export function PreviewDrawer({
  title,
  open,
  onOpenChange,
  schema,
}: {
  title: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: FormSchema;
}) {
  const t = useTranslations("academic.builder");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<FormFiles>({});
  const [today] = useState(() => algiersToday());
  const [lang, setLang] = useState<"en" | "ar">("en");
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={title} description={t("previewHint")} width={520}>
        <div className="mb-4 flex gap-2">
          {(["en", "ar"] as const).map((l) => (
            <Button
              key={l}
              size="sm"
              variant={lang === l ? "primary" : "secondary"}
              onClick={() => setLang(l)}
            >
              {l === "en" ? "English" : "العربية"}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={<CalendarClock />}
            onClick={() => {
              setAnswers({});
              setFiles({});
            }}
          >
            {t("resetPreview")}
          </Button>
        </div>
        <LocaleScope locale={lang}>
          <FormRenderer
            key={lang}
            schema={schema}
            answers={answers}
            onAnswersChange={setAnswers}
            files={files}
            onFilesChange={(next) => setFiles((cur) => (typeof next === "function" ? next(cur) : next))}
            today={today}
            onComplete={() => toast.info(t("previewComplete"))}
          />
        </LocaleScope>
      </DrawerContent>
    </DialogRoot>
  );
}

/** Renders children in another locale (preview EN / AR without leaving the dashboard language). */
function LocaleScope({ locale, children }: { locale: "en" | "ar"; children: ReactNode }) {
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    void import(`../../../../../../../../messages/${locale}.json`).then(
      (m: { default: Record<string, unknown> }) => {
        if (alive) setMessages(m.default);
      },
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  if (!messages) return null;
  return (
    <NextIntlScope locale={locale} messages={messages}>
      <div
        dir={locale === "ar" ? "rtl" : "ltr"}
        lang={locale}
        className={cn(locale === "ar" && "font-arabic")}
      >
        {children}
      </div>
    </NextIntlScope>
  );
}

function VersionDrawer({
  formId,
  versionId,
  onClose,
}: {
  formId: string;
  versionId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("academic.builder.versions");
  const version = useQuery({
    queryKey: formKeys.version(formId, versionId ?? ""),
    queryFn: () => getFormVersion(formId, versionId!),
    enabled: !!versionId,
  });
  const schema = toSchema(version.data?.schema);
  return (
    <PreviewDrawer
      title={version.data ? t("viewTitle", { version: version.data.version }) : t("title")}
      open={!!versionId}
      onOpenChange={(o) => !o && onClose()}
      schema={schema}
    />
  );
}
