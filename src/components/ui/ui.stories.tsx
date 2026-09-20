import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Ban, Download, Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu } from "./action-menu";
import { Count, Pill } from "./badge";
import { Button, IconButton } from "./button";
import { Card, CardBody, CardHeader } from "./card";
import { KeyValueList } from "./key-value-list";
import { StatusBadge, statusTones } from "./status-badge";
import { Tabs, UrlTabs } from "./tabs";

const meta: Meta = { title: "UI/Primitives" };
export default meta;
type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button icon={<Plus />}>Add user</Button>
      <Button variant="secondary" icon={<Download />}>
        Export
      </Button>
      <Button variant="danger" icon={<Ban />}>
        Block account
      </Button>
      <Button variant="danger-outline" icon={<Ban />}>
        Block account
      </Button>
      <Button variant="ghost">Cancel</Button>
      <Button loading>Saving</Button>
      <Button disabled>Disabled</Button>
      <Button size="sm">Small</Button>
      <IconButton label="More actions" variant="outline">
        <MoreHorizontal />
      </IconButton>
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {Object.entries(statusTones).map(([domain, map]) => (
        <div key={domain} className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-12 text-muted">{domain}</span>
          {Object.keys(map).map((s) => (
            <StatusBadge key={s} domain={domain as keyof typeof statusTones} status={s} />
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <Pill tone="gold">Academic</Pill>
        <Pill tone="blue" dot={false}>
          No dot
        </Pill>
        <Count tone="gold">14</Count>
        <Count tone="brand">23</Count>
        <Count tone="red">4</Count>
        <Count>1,236</Count>
      </div>
    </div>
  ),
};
export const BadgesRTL: Story = { ...Badges, globals: { locale: "ar" } };

export const CardWithKeyValues: Story = {
  render: () => (
    <Card className="max-w-[380px]">
      <CardHeader title="Account details" action={<a href="#">Edit</a>} />
      <CardBody>
        <KeyValueList
          rows={[
            { label: "Email", value: "karim@studiolumiere.dz" },
            { label: "Phone", value: "+213 555 12 34 56" },
            { label: "Business", value: "Studio Lumière", href: "/services" },
            { label: "Wilayas served", value: "Alger, Blida, Tipaza" },
            { label: "User ID", value: "usr_8f21c4" },
          ]}
        />
      </CardBody>
    </Card>
  ),
};

export const Header: Story = {
  render: () => (
    <PageHeader
      back
      breadcrumb={[{ label: "Bookings", href: "/bookings" }, { label: "#EVT-2030" }]}
      title="Booking #EVT-2030"
      titleAddon={<StatusBadge domain="booking" status="pending" />}
      subtitle="Requested 12 Mar 2026 at 18:40 · Event on 02 Apr 2026"
      actions={<Button>Change status</Button>}
    />
  ),
};
export const HeaderRTL: Story = { ...Header, globals: { locale: "ar" } };

function TabsDemo() {
  const [v, setV] = useState("all");
  return (
    <Card>
      <Tabs
        value={v}
        onChange={setV}
        items={[
          { key: "all", label: "All", count: "12,480" },
          { key: "clients", label: "Clients", count: "10,906" },
          { key: "providers", label: "Providers", count: "1,236" },
          { key: "admins", label: "Admins", count: 20 },
        ]}
      />
    </Card>
  );
}
export const TabsControlled: Story = { render: () => <TabsDemo /> };
export const TabsUrlSynced: Story = {
  render: () => (
    <Card>
      <UrlTabs
        defaultValue="waiting"
        items={[
          { key: "waiting", label: "Waiting", count: 14 },
          { key: "rejected", label: "Rejected" },
        ]}
      />
    </Card>
  ),
};

export const RowMenu: Story = {
  render: () => (
    <ActionMenu
      header={{ title: "Karim Belkacem", subtitle: "Provider · Studio Lumière" }}
      groups={[
        [
          { icon: <Eye />, label: "Open profile" },
          { icon: <Eye />, label: "View services", hint: 5 },
        ],
        [
          { icon: <Pencil />, label: "Edit details" },
          { icon: <Pencil />, label: "Disabled item", disabled: true },
        ],
        [
          { icon: <Ban />, label: "Block user", danger: true },
          { icon: <Trash2 />, label: "Delete user", danger: true },
        ],
      ]}
      trigger={
        <IconButton label="Row actions" variant="outline">
          <MoreHorizontal />
        </IconButton>
      }
    />
  ),
};
export const RowMenuRTL: Story = { ...RowMenu, globals: { locale: "ar" } };
