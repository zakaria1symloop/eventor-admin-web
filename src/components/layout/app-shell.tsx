"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/button";
import { Sidebar, type SidebarBadges } from "./sidebar";
import { Topbar, type AccountSummary } from "./topbar";
import type { NavKey } from "./nav-config";

export interface AppShellProps {
  children: ReactNode;
  active?: NavKey;
  badges?: SidebarBadges;
  account?: AccountSummary;
  notificationCount?: number;
  notificationsEnabled?: boolean;
  onSignOut?: () => void;
}

export function AppShell({
  children,
  active,
  badges,
  account,
  notificationCount,
  notificationsEnabled,
  onSignOut,
}: AppShellProps) {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-white focus:not-sr-only focus:fixed focus:start-2 focus:top-2"
      >
        {t("app.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar active={active} badges={badges} />
      </div>

      {/* Mobile sidebar (collapsible) */}
      <RadixDialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[#1A0D33]/35 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 start-0 z-50 flex shadow-overlay lg:hidden">
            <RadixDialog.Title className="sr-only">{t("nav.label")}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">{t("nav.label")}</RadixDialog.Description>
            <Sidebar active={active} badges={badges} onNavigate={() => setMobileOpen(false)} />
            <RadixDialog.Close asChild>
              <IconButton label={t("nav.closeMenu")} className="absolute end-2 top-2 bg-surface">
                <X />
              </IconButton>
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          account={account}
          notificationCount={notificationCount}
          notificationsEnabled={notificationsEnabled}
          onOpenSidebar={() => setMobileOpen(true)}
          onSignOut={onSignOut}
        />
        <main
          id="main"
          className="flex-1 px-4 py-6 sm:px-[var(--page-padding-x)] sm:py-[var(--page-padding-y)]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
