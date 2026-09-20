import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Ban,
  Briefcase,
  Calendar,
  Camera,
  Eye,
  MapPin,
  MessageSquare,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValueList } from "@/components/ui/key-value-list";
import { CardLinkRow, DetailHeader, LinkedCounts, SectionNav, TwoColumn } from "./detail";

const meta: Meta = { title: "Layout/Detail pages" };
export default meta;
type Story = StoryObj;

function ProviderProfile() {
  return (
    <div className="max-w-[1100px]">
      <DetailHeader
        avatar={{ name: "Karim Belkacem" }}
        title="Karim Belkacem"
        badges={[
          <Pill key="r" tone="brand">
            Provider
          </Pill>,
          <Pill key="s" tone="green">
            Active
          </Pill>,
          <Pill key="v" tone="blue">
            Verified
          </Pill>,
        ]}
        meta={[
          { icon: <Briefcase />, label: "Studio Lumière · Photography" },
          { icon: <MapPin />, label: "Alger" },
          { icon: <Calendar />, label: "Joined 12 Jan 2025" },
          { icon: <Eye />, label: "Last active 2 h ago" },
        ]}
        actions={
          <>
            <Button variant="secondary" icon={<MessageSquare />}>
              Message
            </Button>
            <Button variant="secondary" icon={<Pencil />}>
              Edit details
            </Button>
          </>
        }
        moreMenu={[
          [{ icon: <Eye />, label: "View as client in app" }],
          [
            { icon: <Ban />, label: "Block account", danger: true },
            { icon: <Trash2 />, label: "Delete account", danger: true },
          ],
        ]}
      >
        <LinkedCounts
          items={[
            { label: "Services", value: 5, hint: "4 published · 1 hidden", href: "/services?provider=1" },
            { label: "Bookings", value: 48, hint: "3 pending · 2 upcoming", href: "/bookings?provider=1" },
            {
              label: "Earned",
              value: "1.92M DA",
              hint: "Completed bookings",
              href: "/bookings?provider=1&status=completed",
            },
            { label: "Rating", value: 4.8, hint: "32 reviews · 1 reported", href: "/reviews?provider=1" },
            { label: "Reply rate", value: "96%", hint: "Avg reply in 1 h 20" },
            { label: "Ready Packs", value: 1, hint: "Fiançailles", href: "/packs?provider=1" },
          ]}
        />
      </DetailHeader>
      <TwoColumn
        main={
          <Card>
            <CardHeader title="Services" action={<a href="#">Open in Services list ›</a>} />
            <CardBody className="text-13 text-muted">…</CardBody>
          </Card>
        }
        aside={
          <>
            <Card>
              <CardHeader
                title="Account details"
                actions={
                  <Button size="sm" variant="secondary" icon={<Pencil />}>
                    Edit
                  </Button>
                }
              />
              <CardBody>
                <KeyValueList
                  rows={[
                    { label: "Email", value: "karim@studiolumiere.dz" },
                    { label: "Business", value: "Studio Lumière", href: "/users/1" },
                    { label: "User ID", value: "usr_8f21c4" },
                  ]}
                />
              </CardBody>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader title="Provider" titleAddon={<Pill tone="blue">Verified</Pill>} />
              <CardLinkRow
                href="/services?provider=1"
                icon={<Camera />}
                label="All services by this provider"
                count={5}
              />
              <CardLinkRow
                href="/reviews?provider=1"
                icon={<Star />}
                label="All reviews of this provider"
                count={32}
              />
            </Card>
          </>
        }
      />
    </div>
  );
}

export const ProfileLayout: Story = { render: () => <ProviderProfile /> };
export const ProfileLayoutRTL: Story = { render: () => <ProviderProfile />, globals: { locale: "ar" } };

function ServiceHeader() {
  return (
    <DetailHeader
      variant="plain"
      icon={<Camera />}
      title="Wedding photo & video coverage"
      badges={[
        <Pill key="p" tone="green">
          Published
        </Pill>,
      ]}
      meta={[
        { label: "Karim Belkacem · Studio Lumière", href: "/users/1" },
        { label: "Photography · Alger, Blida, Tipaza" },
        { label: "ID srv_31a9" },
      ]}
      actions={
        <>
          <Button variant="secondary" icon={<Eye />}>
            View in app
          </Button>
          <Button variant="secondary" icon={<Ban />}>
            Hide service
          </Button>
          <Button icon={<Pencil />}>Edit service</Button>
        </>
      }
      moreMenu={[[{ icon: <Trash2 />, label: "Delete", danger: true }]]}
    />
  );
}
export const ServiceDetailHeader: Story = { render: () => <ServiceHeader /> };

function Sections() {
  const sections = [
    "Commission & pricing",
    "Bookings",
    "Verification",
    "Notifications",
    "Admin accounts",
  ].map((label, i) => ({ id: `s${i}`, label }));
  return (
    <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
      <SectionNav sections={sections} aria-label="Settings sections" />
      <div className="flex flex-col gap-4">
        {sections.map((s) => (
          <Card key={s.id} id={s.id} className="h-64">
            <CardHeader title={s.label} />
          </Card>
        ))}
      </div>
    </div>
  );
}
export const SectionNavigation: Story = { render: () => <Sections /> };
export const SectionNavigationRTL: Story = { render: () => <Sections />, globals: { locale: "ar" } };
