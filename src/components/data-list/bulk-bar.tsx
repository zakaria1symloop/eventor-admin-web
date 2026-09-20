"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/** Appears when rows are selected: "N selected · Clear selection" + actions. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("dataList");
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label={t("selected", { count })}
      className="flex flex-wrap items-center gap-3 bg-brand px-4 py-2.5 text-white"
    >
      <span className="text-13 font-medium">{t("selected", { count })}</span>
      <button type="button" onClick={onClear} className="text-13 text-white/75 hover:text-white">
        {t("clearSelection")}
      </button>
      <div className="ms-auto flex flex-wrap items-center gap-2 [&_button]:border-white/25 [&_button]:bg-transparent [&_button]:text-white [&_button:hover]:bg-white/10">
        {children}
      </div>
    </div>
  );
}
