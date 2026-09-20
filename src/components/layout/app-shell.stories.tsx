import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/states";
import { AppShell } from "./app-shell";
import { PageHeader } from "./page-header";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const badges = {
  verifications: { count: 14, tone: "gold" as const },
  bookings: { count: 23, tone: "brand" as const },
  disputes: { count: 4, tone: "red" as const },
  academicRequests: { count: 6, tone: "brand" as const },
  reviews: { count: 3, tone: "red" as const },
};

const meta: Meta<typeof AppShell> = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: { badges, notificationCount: 5, account: { name: "Sara Meziane" } },
  render: (args) => (
    <AppShell {...args}>
      <PageHeader
        breadcrumb={[{ label: "Manage" }, { label: "Users" }]}
        title="Users"
        subtitle="Every account on Eventor: clients, providers and admins."
        actions={
          <>
            <Button variant="secondary" icon={<Download />}>
              Export
            </Button>
            <Button icon={<Plus />}>Add user</Button>
          </>
        }
      />
      <Card>
        <EmptyState title="Coming in module 4" />
      </Card>
    </AppShell>
  ),
};
export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {};
export const RTL: Story = { globals: { locale: "ar" } };
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile2" } },
  globals: { viewport: { value: "mobile2" } },
};

export const SidebarOnly: StoryObj<typeof Sidebar> = {
  render: () => (
    <div className="h-[760px]">
      <Sidebar badges={badges} />
    </div>
  ),
};
export const SidebarRTL: StoryObj<typeof Sidebar> = { ...SidebarOnly, globals: { locale: "ar" } };

export const TopbarOnly: StoryObj<typeof Topbar> = {
  render: () => <Topbar notificationCount={3} account={{ name: "Sara Meziane" }} />,
};
export const TopbarRTL: StoryObj<typeof Topbar> = { ...TopbarOnly, globals: { locale: "ar" } };
