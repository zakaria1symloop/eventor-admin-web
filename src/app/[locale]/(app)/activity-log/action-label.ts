"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/** `category.updated` → "Edited a category" (messages `activityLog.actions.category_updated`), else humanised. */
export function useActionLabel() {
  const t = useTranslations("activityLog");
  return useCallback(
    (action: string) => {
      const key = `actions.${action.replace(/\./g, "_")}`;
      if (t.has(key)) return t(key);
      const s = action.replace(/[._]/g, " ");
      return s.charAt(0).toUpperCase() + s.slice(1);
    },
    [t],
  );
}
