"use client";

import { ChevronLeft, ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DialogContent, DialogRoot } from "@/components/feedback/dialog";
import { IconButton } from "@/components/ui/button";
import type { Photo } from "@/lib/api/services";
import { cn } from "@/lib/utils/cn";

/** Read-only photo strip with a lightbox (SRV-04 / PCK-02). Arrow keys move between photos. */
export function PhotoGallery({
  photos,
  title,
  className,
}: {
  photos: Photo[];
  title: string;
  className?: string;
}) {
  const t = useTranslations("photos");
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const rtl = document.documentElement.dir === "rtl";
      if (e.key === (rtl ? "ArrowLeft" : "ArrowRight"))
        setIndex((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === (rtl ? "ArrowRight" : "ArrowLeft"))
        setIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  if (photos.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-13 text-muted", className)}>
        <ImageOff className="size-4" aria-hidden /> {t("none")}
      </div>
    );
  }
  const current = index !== null ? photos[index] : null;
  return (
    <>
      <ul className={cn("grid grid-cols-3 gap-3 sm:grid-cols-6", className)}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t("openPhoto", { n: i + 1 })}
              className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-soft outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {p.processingStatus === "pending" ? (
                <span className="flex size-full items-center justify-center text-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbUrl || p.url} alt="" loading="lazy" className="size-full object-cover" />
              )}
              {p.isCover && (
                <span className="absolute start-1.5 top-1.5 rounded-pill bg-brand px-1.5 text-11 font-medium text-white">
                  {t("cover")}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <DialogRoot open={open} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent
          title={title}
          description={index !== null ? t("nOfTotal", { n: index + 1, total: photos.length }) : undefined}
          width={960}
        >
          {current && (
            <div className="relative flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.mediumUrl || current.url}
                alt={t("photoN", { n: (index ?? 0) + 1 })}
                className="max-h-[70dvh] w-auto rounded-lg object-contain"
              />
              {photos.length > 1 && (
                <>
                  <IconButton
                    label={t("previous")}
                    variant="outline"
                    className="absolute start-2 bg-surface"
                    onClick={() => setIndex(((index ?? 0) - 1 + photos.length) % photos.length)}
                  >
                    <ChevronLeft className="flip-rtl" />
                  </IconButton>
                  <IconButton
                    label={t("next")}
                    variant="outline"
                    className="absolute end-2 bg-surface"
                    onClick={() => setIndex(((index ?? 0) + 1) % photos.length)}
                  >
                    <ChevronRight className="flip-rtl" />
                  </IconButton>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </DialogRoot>
    </>
  );
}
