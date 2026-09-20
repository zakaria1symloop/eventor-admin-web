"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { categoryKeys, listCategories, listWilayas, wilayaKeys } from "@/lib/api/catalog";

/** Category and wilaya options for user filters and forms (small, cached catalogues). */
export function useUserOptions() {
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
  const ar = locale === "ar";
  const categoryOptions = useMemo(
    () =>
      (categories.data?.data ?? []).map((c) => ({
        value: c.id,
        label: (ar ? c.nameAr || c.nameEn : c.nameEn || c.nameAr) ?? "",
      })),
    [categories.data, ar],
  );
  const wilayaOptions = useMemo(
    () =>
      [...(wilayas.data?.data ?? [])]
        .sort((a, b) => a.code - b.code)
        .map((w) => ({ value: String(w.code), label: `${w.code} · ${ar ? w.nameAr || w.name : w.name}` })),
    [wilayas.data, ar],
  );
  return { categoryOptions, wilayaOptions };
}

export function localName(
  ref: { nameEn?: string; name?: string; nameAr: string } | null | undefined,
  locale: string,
) {
  if (!ref) return "";
  const latin = ref.nameEn ?? ref.name ?? "";
  return locale === "ar" ? ref.nameAr || latin : latin || ref.nameAr;
}
