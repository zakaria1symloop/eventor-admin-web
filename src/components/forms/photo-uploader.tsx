"use client";

import { AlertCircle, ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/button";

export type PhotoStatus = "uploading" | "processing" | "ready" | "failed";

export interface PhotoItem {
  /** Server file id once uploaded, a temporary id before. */
  id: string;
  url: string;
  status: PhotoStatus;
  /** 0–100 while uploading */
  progress?: number;
}

export interface PhotoUploaderProps {
  value: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  /** Max photos (from settings). */
  limit: number;
  maxSizeMb?: number;
  accept?: string[];
  /**
   * Uploads one file. Report progress 0–100. Resolve with the server id/url;
   * `processing: true` keeps the "Processing…" state until the job finishes.
   */
  upload?: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<{ id: string; url: string; processing?: boolean }>;
  disabled?: boolean;
}

const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp"];

let tempSeq = 0;

/** Photos grid: "8 / 12", drag to reorder, cover = first, type/size/limit checks, progress, processing. */
export function PhotoUploader({
  value,
  onChange,
  limit,
  maxSizeMb = 10,
  accept = DEFAULT_ACCEPT,
  upload,
  disabled,
}: PhotoUploaderProps) {
  const t = useTranslations("photos");
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Latest list for async upload callbacks.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const full = value.length >= limit;

  function patch(id: string, p: Partial<PhotoItem>) {
    const next = latest.current.map((it) => (it.id === id ? { ...it, ...p } : it));
    latest.current = next;
    onChange(next);
  }

  function addFiles(files: File[]) {
    const problems: string[] = [];
    const room = limit - value.length;
    const accepted: File[] = [];
    for (const f of files) {
      if (!accept.includes(f.type)) problems.push(t("wrongType", { name: f.name }));
      else if (f.size > maxSizeMb * 1024 * 1024)
        problems.push(t("tooLarge", { name: f.name, max: maxSizeMb }));
      else accepted.push(f);
    }
    if (accepted.length > room) {
      problems.push(t("overLimit", { count: accepted.length - Math.max(room, 0), limit }));
      accepted.splice(Math.max(room, 0));
    }
    setErrors(problems);
    if (accepted.length === 0) return;

    const created = accepted.map((file) => ({
      file,
      item: {
        id: `tmp-${++tempSeq}`,
        url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "",
        status: upload ? ("uploading" as const) : ("ready" as const),
        progress: 0,
      },
    }));
    const next = [...value, ...created.map((c) => c.item)];
    latest.current = next;
    onChange(next);

    if (!upload) return;
    for (const { file, item } of created) {
      upload(file, (progress) => patch(item.id, { progress }))
        .then((res) => {
          const cur = latest.current.map((it) =>
            it.id === item.id
              ? {
                  id: res.id,
                  url: res.url,
                  status: res.processing ? ("processing" as const) : ("ready" as const),
                }
              : it,
          );
          latest.current = cur;
          onChange(cur);
        })
        .catch(() => patch(item.id, { status: "failed" }));
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-13">
        <span className="text-muted">{t("hint", { max: maxSizeMb })}</span>
        <span
          className={cn("font-medium tabular-nums", full ? "text-amber" : "text-ink-2")}
          aria-live="polite"
        >
          {t("count", { count: value.length, limit })}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((p, i) => (
          <li
            key={p.id}
            draggable={!disabled}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            aria-label={t("photoN", { n: i + 1 })}
            className={cn(
              "group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-gray-soft",
              dragIndex === i && "opacity-50",
              p.status === "failed" && "border-red",
            )}
          >
            {p.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt="" className="size-full object-cover" />
            )}
            {i === 0 && (
              <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-pill bg-brand px-2 py-0.5 text-11 font-medium text-white">
                <Star className="size-3" aria-hidden /> {t("cover")}
              </span>
            )}
            {p.status !== "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface/80 text-12 text-ink-2">
                {p.status === "failed" ? (
                  <>
                    <AlertCircle className="size-5 text-red" aria-hidden />
                    <span className="text-red">{t("failed")}</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
                    <span>
                      {p.status === "processing"
                        ? t("processing")
                        : t("uploading", { progress: p.progress ?? 0 })}
                    </span>
                    {p.status === "uploading" && (
                      <span
                        role="progressbar"
                        aria-valuenow={p.progress ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-1 w-2/3 overflow-hidden rounded-pill bg-gray-soft"
                      >
                        <span className="block h-full bg-brand" style={{ width: `${p.progress ?? 0}%` }} />
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
            {!disabled && (
              <div className="absolute end-1.5 top-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <IconButton
                  label={t("moveEarlier")}
                  size="sm"
                  className="size-7 bg-surface"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                >
                  <ArrowLeft className="flip-rtl" />
                </IconButton>
                <IconButton
                  label={t("moveLater")}
                  size="sm"
                  className="size-7 bg-surface"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1}
                >
                  <ArrowRight className="flip-rtl" />
                </IconButton>
                <IconButton
                  label={t("remove")}
                  size="sm"
                  className="size-7 bg-surface"
                  onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                >
                  <X />
                </IconButton>
              </div>
            )}
          </li>
        ))}
        {!full && (
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
              }}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#CFCBD8] text-13 text-muted hover:border-brand hover:text-brand disabled:opacity-50"
            >
              <ImagePlus className="size-5" aria-hidden />
              {t("add")}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        data-testid="photo-input"
        accept={accept.join(",")}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {errors.length > 0 && (
        <ul role="alert" className="mt-2 flex flex-col gap-0.5 text-12 text-red">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
