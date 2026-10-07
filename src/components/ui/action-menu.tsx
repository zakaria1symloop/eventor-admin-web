"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { DROPDOWN_COLLISION_PADDING, menuSurface } from "./dropdown";

export interface ActionMenuItem {
  icon?: ReactNode;
  label: ReactNode;
  onSelect?: () => void;
  href?: string;
  shortcut?: ReactNode;
  /** right-aligned hint, e.g. a count */
  hint?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps {
  trigger: ReactNode;
  groups: ActionMenuItem[][];
  header?: { title: ReactNode; subtitle?: ReactNode };
  align?: "start" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const itemClass =
  "flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-13 text-ink outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-canvas [&_svg]:size-4 [&_svg]:text-ink-2";

export function ActionMenu({ trigger, groups, header, align = "end", open, onOpenChange }: ActionMenuProps) {
  return (
    <Dropdown.Root open={open} onOpenChange={onOpenChange}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={6}
          collisionPadding={DROPDOWN_COLLISION_PADDING}
          className={cn(menuSurface, "min-w-[240px]")}
        >
          {header && (
            <>
              <div className="px-2 pt-1 pb-2">
                <div className="text-13 font-medium text-ink">{header.title}</div>
                {header.subtitle && <div className="text-12 text-muted">{header.subtitle}</div>}
              </div>
              <Dropdown.Separator className="-mx-1.5 my-1 h-px bg-border" />
            </>
          )}
          {groups.map((group, gi) => (
            <Dropdown.Group key={gi}>
              {gi > 0 && <Dropdown.Separator className="-mx-1.5 my-1 h-px bg-border" />}
              {group.map((item, ii) => {
                const content = (
                  <>
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.hint !== undefined && (
                      <span className="text-12 text-faint tabular-nums">{item.hint}</span>
                    )}
                    {item.shortcut && <kbd className="text-11 text-faint">{item.shortcut}</kbd>}
                  </>
                );
                const cls = cn(itemClass, item.danger && "text-red [&_svg]:text-red");
                if (item.href && !item.disabled) {
                  return (
                    <Dropdown.Item key={ii} asChild className={cls}>
                      <Link href={item.href}>{content}</Link>
                    </Dropdown.Item>
                  );
                }
                return (
                  <Dropdown.Item
                    key={ii}
                    className={cls}
                    disabled={item.disabled}
                    onSelect={() => item.onSelect?.()}
                  >
                    {content}
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Group>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
