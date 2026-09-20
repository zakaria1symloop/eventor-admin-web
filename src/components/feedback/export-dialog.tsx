"use client";

import { FileText } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select } from "@/components/forms/fields";
import { createExport, getExport, type ExportFormat, type ExportJob } from "@/lib/api/exports";
import { ApiError } from "@/lib/api/errors";
import { Banner } from "./banner";
import { DialogContent, DialogRoot } from "./dialog";
import { toast } from "./toast";

export interface ExportColumnOption {
  key: string;
  label: string;
  /** Checked by default. Default true. */
  defaultChecked?: boolean;
}

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Export resource (`GET /admin/exports/resources`), e.g. `activity-log`. */
  resource: string;
  title: ReactNode;
  /** List filters, same names as the list query parameters. */
  filters: Record<string, unknown>;
  /** "3,282 bookings · Tab All · Event date Mar 2026" */
  summary: ReactNode;
  summaryHint?: ReactNode;
  columns: ExportColumnOption[];
  /** Test hooks. */
  pollIntervalMs?: number;
  maxPolls?: number;
}

function openFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.target = "_blank";
  a.click();
}

/** STA-05: current filters summary, format, columns. Small exports download now; large ones are emailed. */
export function ExportDialog({
  open,
  onOpenChange,
  resource,
  title,
  filters,
  summary,
  summaryHint,
  columns,
  pollIntervalMs = 2000,
  maxPolls = 30,
}: ExportDialogProps) {
  const t = useTranslations("export");
  const tc = useTranslations("common");
  const initial = () => columns.filter((c) => c.defaultChecked !== false).map((c) => c.key);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [selected, setSelected] = useState<string[]>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(initial());
      setError(null);
      setPending(false);
    }
  }

  async function pollInBackground(job: ExportJob) {
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      try {
        const next = await getExport(job.id);
        if (next.status === "done" && next.fileUrl) {
          const url = next.fileUrl;
          toast.success(t("ready"), { action: { label: t("download"), onClick: () => openFile(url) } });
          return;
        }
        if (next.status === "failed") {
          toast.error(t("failed"), { description: next.error ?? undefined });
          return;
        }
      } catch {
        return;
      }
    }
  }

  async function submit() {
    if (selected.length === 0) {
      setError(t("pickColumns"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const ordered = columns.map((c) => c.key).filter((k) => selected.includes(k));
      const job = await createExport({ resource, filters, columns: ordered, format });
      if (job.status === "failed") throw new Error(job.error ?? t("failed"));
      if (job.status === "done" && job.fileUrl) {
        openFile(job.fileUrl);
        toast.success(t("downloaded", { count: job.rowCount ?? 0 }));
      } else {
        toast.info(t("queuedTitle"), { description: t("queuedDescription") });
        void pollInBackground(job);
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title={title}
        description={t("description")}
        icon={<FileText />}
        width={520}
        footer={
          <>
            <span className="me-auto text-12 text-muted">{t("largeEmailed")}</span>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button icon={<FileText />} loading={pending} onClick={submit}>
              {t("export")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="red" title={error} />}
          <div className="rounded-lg bg-canvas px-3 py-2.5">
            <div className="text-13 font-medium text-ink">{summary}</div>
            {summaryHint && <div className="text-12 text-muted">{summaryHint}</div>}
          </div>
          <Field label={t("format")}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              options={[
                { value: "xlsx", label: t("xlsx") },
                { value: "csv", label: t("csv") },
              ]}
            />
          </Field>
          <fieldset>
            <legend className="mb-2 text-13 font-medium text-ink">{t("columns")}</legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
              {columns.map((c) => (
                <Checkbox
                  key={c.key}
                  label={c.label}
                  checked={selected.includes(c.key)}
                  disabled={pending}
                  onCheckedChange={(on) =>
                    setSelected((s) => (on ? [...s, c.key] : s.filter((k) => k !== c.key)))
                  }
                />
              ))}
            </div>
          </fieldset>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/** List params → export filters (drops paging, keeps tab/q/sort and filter values). */
export function listParamsToExportFilters(params: {
  q: string;
  tab: string;
  sort: string;
  filters: Record<string, string | string[]>;
}): Record<string, unknown> {
  const f: Record<string, unknown> = { ...params.filters };
  if (params.q) f.q = params.q;
  if (params.tab && params.tab !== "all") f.tab = params.tab;
  return f;
}
