"use client";

import { CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/feedback/banner";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { toast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { downloadCommunesTemplate, importCommunes, type CommunesImportResult } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/errors";

/** Result summary + per-line errors of a communes CSV import. */
export function ImportResultSummary({ result }: { result: CommunesImportResult }) {
  const t = useTranslations("locations.import");
  const stats = [
    { key: "created", value: result.created, tone: "text-green" },
    { key: "updated", value: result.updated, tone: "text-blue" },
    { key: "skipped", value: result.skipped, tone: "text-muted" },
    { key: "failed", value: result.errors.length, tone: result.errors.length ? "text-red" : "text-muted" },
  ] as const;
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <Banner
        tone={result.errors.length ? "amber" : "green"}
        icon={result.errors.length ? undefined : <CheckCircle2 />}
        title={result.errors.length ? t("doneWithErrors", { count: result.errors.length }) : t("done")}
      />
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="rounded-lg border border-border px-3 py-2">
            <dt className="text-12 text-muted">{t(`stats.${s.key}`)}</dt>
            <dd className={`text-18 font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {result.errors.length > 0 && (
        <div className="max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full text-13">
            <caption className="sr-only">{t("errorsCaption")}</caption>
            <thead className="bg-[#FAFAFB] text-11 text-muted uppercase">
              <tr>
                <th scope="col" className="w-20 px-3 py-2 text-start font-medium">
                  {t("line")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("problem")}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={`${e.line}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2 text-ink-2 tabular-nums">{e.line}</td>
                  <td className="px-3 py-2 text-red">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ImportCommunesDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: CommunesImportResult) => void;
}) {
  const t = useTranslations("locations.import");
  const tc = useTranslations("common");
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommunesImportResult | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFile(null);
      setError(null);
      setResult(null);
    }
  }

  async function submit() {
    if (!file) return setError(t("pickFile"));
    setPending(true);
    setError(null);
    try {
      const r = await importCommunes(file);
      setResult(r);
      onImported?.(r);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title={t("title")}
        description={t("description")}
        icon={<FileUp />}
        width={560}
        footer={
          <>
            <Button
              variant="ghost"
              icon={<Download />}
              className="me-auto text-brand"
              onClick={() => downloadCommunesTemplate().catch((e) => toast.apiError(e))}
            >
              {t("template")}
            </Button>
            {result ? (
              <Button onClick={() => onOpenChange(false)}>{tc("close")}</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
                  {tc("cancel")}
                </Button>
                <Button icon={<Upload />} loading={pending} disabled={!file} onClick={submit}>
                  {t("import")}
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="red" title={error} />}
          {result ? (
            <ImportResultSummary result={result} />
          ) : (
            <>
              <label
                htmlFor={inputId}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-canvas px-4 py-8 text-center hover:border-brand/40"
              >
                <FileUp className="size-6 text-brand" aria-hidden />
                <span className="text-14 font-medium text-ink">{file ? file.name : t("choose")}</span>
                <span className="text-12 text-muted">{t("hint")}</span>
                <input
                  id={inputId}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setError(null);
                  }}
                />
              </label>
              <p className="text-12 text-muted">
                {t("columns")} <code dir="ltr">wilaya_code, name, name_ar, postal_code</code>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
