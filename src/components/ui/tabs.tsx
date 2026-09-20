"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { parseAsString, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Count } from "./badge";

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: number | string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}

/** Underline tabs with count chips (Figma list header). Controlled. */
export function Tabs({ items, value, onChange, className, children, ...rest }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange} className={className}>
      <RadixTabs.List
        aria-label={rest["aria-label"]}
        className="flex items-end gap-6 overflow-x-auto border-b border-border px-4"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.key}
            value={item.key}
            className={cn(
              "-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-transparent text-14 whitespace-nowrap text-ink-2 transition-colors hover:text-ink",
              "data-[state=active]:border-brand data-[state=active]:font-medium data-[state=active]:text-brand",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <Count tone={item.key === value ? "brand" : "gray"}>{item.count}</Count>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;

/** `?tab=` synced tabs. */
export function useTabParam(defaultKey: string) {
  return useQueryState("tab", parseAsString.withDefault(defaultKey).withOptions({ history: "replace" }));
}

export function UrlTabs(props: Omit<TabsProps, "value" | "onChange"> & { defaultValue: string }) {
  const { defaultValue, ...rest } = props;
  const [tab, setTab] = useTabParam(defaultValue);
  return <Tabs {...rest} value={tab} onChange={(k) => void setTab(k === defaultValue ? null : k)} />;
}
