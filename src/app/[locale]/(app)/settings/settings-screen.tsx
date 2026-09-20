"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bell, CalendarDays, Camera, LayoutGrid, LifeBuoy, User, Wrench } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SectionNav } from "@/components/layout/detail";
import { CardSkeleton, ErrorState } from "@/components/feedback/states";
import { UnsavedChangesGuard } from "@/components/feedback/unsaved-changes-guard";
import { Card } from "@/components/ui/card";
import { getSettings, settingsKeys, type SettingSectionKey } from "@/lib/api/settings";
import { AdminAccountsSection } from "./admin-accounts";
import { SettingsSectionCard } from "./settings-sections";

const SECTIONS: { id: SettingSectionKey; icon: React.ReactNode }[] = [
  { id: "commission", icon: <BarChart3 /> },
  { id: "bookings", icon: <CalendarDays /> },
  { id: "uploads", icon: <Camera /> },
  { id: "languages", icon: <LayoutGrid /> },
  { id: "notifications", icon: <Bell /> },
  { id: "support", icon: <LifeBuoy /> },
  { id: "maintenance", icon: <Wrench /> },
];

/** SET-01 — one card per section, each with its own dirty state and Save. */
export function SettingsScreen() {
  const t = useTranslations("settings");
  const settings = useQuery({ queryKey: settingsKeys.detail(), queryFn: getSettings });
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const onDirtyChange = useCallback(
    (key: string, value: boolean) => setDirty((d) => (d[key] === value ? d : { ...d, [key]: value })),
    [],
  );

  const nav = useMemo(
    () => [
      ...SECTIONS.map((s) => ({ id: s.id, icon: s.icon, label: t(`sections.${s.id}`) })),
      { id: "admins", icon: <User />, label: t("sections.admins") },
    ],
    [t],
  );

  const itemsOf = (key: SettingSectionKey) =>
    settings.data?.sections.find((s) => s.key === key)?.settings ?? [];

  const card = (key: SettingSectionKey) => (
    <SettingsSectionCard key={key} sectionKey={key} items={itemsOf(key)} onDirtyChange={onDirtyChange} />
  );

  return (
    <UnsavedChangesGuard when={Object.values(dirty).some(Boolean)}>
      <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SectionNav sections={nav} aria-label={t("sectionsLabel")} />
        <div className="flex min-w-0 flex-col gap-4">
          {settings.isPending ? (
            SECTIONS.slice(0, 3).map((s) => <CardSkeleton key={s.id} className="h-40" />)
          ) : settings.isError ? (
            <Card>
              <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
            </Card>
          ) : (
            <>
              {card("commission")}
              {card("bookings")}
              {card("uploads")}
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {card("languages")}
                {card("notifications")}
              </div>
              {card("support")}
              {card("maintenance")}
            </>
          )}
          <AdminAccountsSection id="admins" />
        </div>
      </div>
    </UnsavedChangesGuard>
  );
}
