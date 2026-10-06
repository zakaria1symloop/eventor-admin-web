"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/feedback/toast";
import { initials } from "@/lib/utils/format";

/**
 * A person's photo with "Change photo" / "Remove photo" (My account). The server
 * checks the size and type (`max_photo_upload_mb`, `allowed_image_types`) and its
 * message is shown as a toast when it refuses.
 */
export function AvatarField({
  name,
  src,
  onUpload,
  onRemove,
}: {
  name: string;
  src: string | null | undefined;
  onUpload: (file: File) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}) {
  const t = useTranslations("avatar");
  const { pick, input, busy: uploading } = useImagePicker(onUpload, t("updated"));
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await onRemove();
      toast.success(t("removed"));
    } catch (e) {
      toast.apiError(e);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-14 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-18 font-semibold text-brand">
          {initials(name)}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" icon={<Camera />} loading={uploading} onClick={pick}>
          {t("change")}
        </Button>
        {src && (
          <Button type="button" variant="ghost" icon={<Trash2 />} loading={removing} onClick={() => void remove()}>
            {t("remove")}
          </Button>
        )}
      </div>
      {input}
    </div>
  );
}

/** A hidden image `<input type="file">`: `pick()` opens it, the chosen file goes to `onFile`. */
export function useImagePicker(onFile: (file: File) => Promise<unknown>, successMessage: string) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await onFile(file);
      toast.success(successMessage);
    } catch (err) {
      toast.apiError(err);
    } finally {
      setBusy(false);
    }
  };

  return {
    pick: () => ref.current?.click(),
    busy,
    input: (
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="avatar-file"
        onChange={(e) => void onChange(e)}
      />
    ),
  };
}
