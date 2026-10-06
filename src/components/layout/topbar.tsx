"use client";

import { ChevronDown, LogOut, Menu, Settings, User } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { cn } from "@/lib/utils/cn";
import { CommandPalette, GlobalSearchTrigger, useCommandPaletteShortcut } from "./command-palette";
import { LanguageSwitch } from "./language-switch";
import { NotificationPanel } from "./notification-panel";

export { NotificationBell } from "./notification-panel";

export interface AccountSummary {
  name: string;
  role?: string;
  /** Photo URL; initials when absent. */
  avatarUrl?: string | null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AccountMenu({ account, onSignOut }: { account: AccountSummary; onSignOut?: () => void }) {
  const t = useTranslations("account");
  const tt = useTranslations("topbar");
  return (
    <ActionMenu
      groups={[
        [
          { icon: <User />, label: t("myAccount"), href: "/account" },
          { icon: <Settings />, label: t("settings"), href: "/settings" },
        ],
        [{ icon: <LogOut />, label: t("signOut"), onSelect: onSignOut, danger: true }],
      ]}
      trigger={
        <button
          type="button"
          aria-label={tt("accountMenu")}
          className="flex h-10 items-center gap-2.5 rounded-md ps-1 pe-2 text-start hover:bg-canvas"
        >
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-13 font-semibold text-brand">
              {initials(account.name)}
            </span>
          )}
          <span className="hidden leading-tight md:block">
            <span className="block text-13 font-medium text-ink">{account.name}</span>
            <span className="block text-12 text-muted">{account.role ?? t("role")}</span>
          </span>
          <ChevronDown aria-hidden className="hidden size-4 text-muted md:block" />
        </button>
      }
    />
  );
}

export interface TopbarProps {
  account?: AccountSummary;
  notificationCount?: number;
  /** Signed-in shell: notifications come from the API (SHL-02). */
  notificationsEnabled?: boolean;
  onOpenSidebar?: () => void;
  onSignOut?: () => void;
  className?: string;
}

export function Topbar({
  account = { name: "Sara Meziane" },
  notificationCount = 0,
  notificationsEnabled = false,
  onOpenSidebar,
  onSignOut,
  className,
}: TopbarProps) {
  const t = useTranslations("nav");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggle = useCallback((fn: (o: boolean) => boolean) => setPaletteOpen(fn), []);
  useCommandPaletteShortcut(toggle);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-surface px-4 lg:px-8",
        className,
      )}
    >
      {onOpenSidebar && (
        <IconButton label={t("openMenu")} onClick={onOpenSidebar} className="lg:hidden">
          <Menu />
        </IconButton>
      )}
      <GlobalSearchTrigger onOpen={() => setPaletteOpen(true)} />
      <div className="ms-auto flex items-center gap-3 lg:gap-4">
        <LanguageSwitch />
        <NotificationPanel enabled={notificationsEnabled} count={notificationCount} />
        <span aria-hidden className="hidden h-7 w-px bg-border md:block" />
        <AccountMenu account={account} onSignOut={onSignOut} />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
