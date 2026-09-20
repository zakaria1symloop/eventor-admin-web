"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Count } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { listRequests, requestKeys } from "@/lib/api/academic-requests";
import { formKeys, listForms } from "@/lib/api/forms";
import { cn } from "@/lib/utils/cn";

/** Page-level "Requests · Forms" tabs (ACR-01 / ACR-05). */
export function AcademicTabs({ active }: { active: "requests" | "forms" }) {
  const t = useTranslations("academic.tabs");
  const requests = useQuery({
    queryKey: [...requestKeys.all, "total"],
    queryFn: () => listRequests({ limit: 1 }),
    staleTime: 60_000,
  });
  const forms = useQuery({
    queryKey: [...formKeys.all, "total"],
    queryFn: () => listForms({ limit: 1 }),
    staleTime: 60_000,
  });
  const items = [
    {
      key: "requests",
      href: "/academic-requests",
      label: t("requests"),
      count: requests.data?.meta.counts?.all,
    },
    {
      key: "forms",
      href: "/academic-requests/forms",
      label: t("forms"),
      count: forms.data?.meta.counts?.all,
    },
  ] as const;
  return (
    <nav aria-label={t("label")} className="mb-5 flex items-end gap-6 border-b border-border">
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-1 text-14",
              on ? "border-brand font-medium text-brand" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {it.label}
            {it.count !== undefined && <Count tone={on ? "brand" : "gray"}>{it.count}</Count>}
          </Link>
        );
      })}
    </nav>
  );
}
