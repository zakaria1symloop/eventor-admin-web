"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { EmptyState } from "@/components/feedback/states";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface ViewerFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
  /** "Karima · 08 Mar" */
  meta?: ReactNode;
}

export const isImage = (mime: string) => mime.startsWith("image/");
export const isPdf = (mime: string) => mime === "application/pdf";

export function formatBytes(bytes: number | undefined, locale = "en"): string {
  if (bytes === undefined) return "";
  const units = locale === "ar" ? ["بايت", "ك.ب", "م.ب"] : ["B", "KB", "MB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${u === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}

/**
 * The API serves files with `X-Frame-Options: SAMEORIGIN`, so a cross-origin iframe stays blank.
 * Fetch the signed URL (CORS) and frame a same-origin blob instead; fall back to the Open link.
 */
export function PdfFrame({ url, label, className }: { url: string; label: string; className?: string }) {
  const t = useTranslations("domain.files");
  const [state, setState] = useState<{ url: string; blob: string | null; failed: boolean }>({
    url,
    blob: null,
    failed: false,
  });
  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setState({ url, blob: objectUrl, failed: false });
      })
      .catch(() => !revoked && setState({ url, blob: null, failed: true }));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  if (state.failed) {
    return <EmptyState icon={<FileText />} title={t("noPreview")} description={t("noPreviewHint")} />;
  }
  if (!state.blob) {
    return (
      <div
        className={cn("h-[70vh] min-h-[520px] w-full animate-pulse rounded-md bg-surface", className)}
        aria-busy="true"
      />
    );
  }
  return (
    <iframe
      src={state.blob}
      title={label}
      className={cn("h-[70vh] min-h-[520px] w-full rounded-md bg-surface shadow-overlay", className)}
    />
  );
}

/** Image lightbox / PDF viewer for private files (evidence DSP-02, attachments ACR-02), with prev / next. */
export function FileViewerDialog({
  files,
  index,
  onIndexChange,
  onClose,
}: {
  files: ViewerFile[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("domain.files");
  const file = index !== null ? files[index] : undefined;
  return (
    <DialogRoot open={!!file} onOpenChange={(o) => !o && onClose()}>
      {file && (
        <DialogContent
          title={file.name}
          description={file.meta}
          width={960}
          footer={
            <>
              <span className="me-auto text-12 text-muted">
                {t("position", { index: (index ?? 0) + 1, total: files.length })}
              </span>
              <IconButton
                label={t("previous")}
                variant="outline"
                disabled={index === 0}
                onClick={() => onIndexChange((index ?? 0) - 1)}
              >
                <ChevronLeft className="flip-rtl" />
              </IconButton>
              <IconButton
                label={t("next")}
                variant="outline"
                disabled={index === files.length - 1}
                onClick={() => onIndexChange((index ?? 0) + 1)}
              >
                <ChevronRight className="flip-rtl" />
              </IconButton>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[34px] items-center gap-2 rounded-md border border-border bg-surface px-3.5 text-14 font-medium text-ink hover:bg-canvas [&_svg]:size-4"
              >
                <ExternalLink aria-hidden />
                {t("open")}
              </a>
            </>
          }
        >
          <div className="flex min-h-[320px] items-center justify-center rounded-lg bg-canvas p-3">
            {isImage(file.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.url}
                alt={file.name}
                className="max-h-[70vh] max-w-full rounded-md object-contain"
              />
            ) : isPdf(file.mimeType) ? (
              <PdfFrame url={file.url} label={file.name} />
            ) : (
              <EmptyState icon={<Download />} title={t("noPreview")} description={t("noPreviewHint")} />
            )}
          </div>
        </DialogContent>
      )}
    </DialogRoot>
  );
}

/** Tile of a file (evidence grid): thumbnail for images, icon otherwise. */
export function FileTile({
  file,
  onOpen,
  icon,
}: {
  file: { name: string; mimeType?: string; url?: string; meta?: ReactNode };
  onOpen?: () => void;
  icon?: ReactNode;
}) {
  const image = file.mimeType && file.url && isImage(file.mimeType);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface p-2 text-start hover:border-brand/40 disabled:cursor-default disabled:hover:border-border"
    >
      <span className="flex aspect-[5/3] w-full items-center justify-center overflow-hidden rounded-md bg-gray-soft text-muted [&_svg]:size-5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="size-full object-cover" />
        ) : (
          (icon ?? (file.mimeType && isPdf(file.mimeType) ? <FileText /> : <ImageIcon />))
        )}
      </span>
      <span className="min-w-0 px-1 leading-tight">
        <span className="block truncate text-13 font-medium text-ink">{file.name}</span>
        {file.meta && <span className="block truncate text-12 text-muted">{file.meta}</span>}
      </span>
    </button>
  );
}
