"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import type { Option } from "@/components/forms/select-inputs";
import { categoryKeys, listCategories, listWilayas, wilayaKeys } from "@/lib/api/catalog";
import { flattenSettings, getSettings, settingsKeys } from "@/lib/api/settings";
import { listUsers, userKeys } from "@/lib/api/users";
import { localName } from "../users/use-user-options";

/** Categories (visible flag), wilayas (open flag) and providers for service/pack filters and forms. */
export function useCatalog() {
  const locale = useLocale();
  const categories = useQuery({
    queryKey: [...categoryKeys.all, "options"],
    queryFn: () => listCategories({ limit: 100, sort: "position:asc" }),
    staleTime: 5 * 60_000,
  });
  const wilayas = useQuery({
    queryKey: [...wilayaKeys.all, "options"],
    queryFn: () => listWilayas({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const providers = useQuery({
    queryKey: [...userKeys.all, "provider-options"],
    queryFn: () => listUsers({ role: "provider", limit: 100, sort: "fullName:asc" }),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const cats = categories.data?.data ?? [];
    const wils = [...(wilayas.data?.data ?? [])].sort((a, b) => a.code - b.code);
    const provs = providers.data?.data ?? [];
    return {
      categories: cats,
      wilayas: wils,
      categoryOptions: cats.map((c) => ({ value: c.id, label: localName(c, locale) })),
      visibleCategoryOptions: cats
        .filter((c) => c.isVisible)
        .map((c) => ({ value: c.id, label: localName(c, locale) })),
      wilayaOptions: wils.map((w) => ({
        value: String(w.code),
        label: `${w.code} · ${localName(w, locale)}`,
      })),
      openWilayaOptions: wils
        .filter((w) => w.isOpen)
        .map((w) => ({ value: String(w.code), label: `${w.code} · ${localName(w, locale)}` })),
      providerOptions: provs.map((p) => ({
        value: p.id,
        label: p.businessName ? `${p.businessName} · ${p.fullName}` : p.fullName,
      })),
    };
  }, [categories.data, wilayas.data, providers.data, locale]);
}

/** Provider search for AsyncSelect (`GET /admin/users?role=provider&q=`). */
export async function searchProviders(q: string): Promise<Option[]> {
  const res = await listUsers({ role: "provider", q: q || undefined, limit: 20 });
  return res.data.map((p) => ({
    value: p.id,
    label: p.businessName ? `${p.fullName} · ${p.businessName}` : p.fullName,
    sub: [p.email, p.verificationStatus === "verified" ? null : p.verificationStatus]
      .filter(Boolean)
      .join(" · "),
  }));
}

/** `max_photos_per_service` / `max_photos_per_pack` from settings (defaults 12 / 6). */
export function usePhotoLimits() {
  const q = useQuery({ queryKey: settingsKeys.detail(), queryFn: getSettings, staleTime: 5 * 60_000 });
  const flat = q.data ? flattenSettings(q.data) : {};
  const num = (k: string, d: number) => (typeof flat[k]?.value === "number" ? (flat[k].value as number) : d);
  return {
    service: num("max_photos_per_service", 12),
    pack: num("max_photos_per_pack", 6),
    uploadMb: num("max_photo_upload_mb", 10),
  };
}
