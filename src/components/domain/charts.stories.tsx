import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DateRangePopover } from "@/components/forms/date-range-popover";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { ChartLegend, KpiTile, StackedBarChart, StatBarList } from "./charts";

const meta: Meta = { title: "Domain/Overview & shell" };
export default meta;
type Story = StoryObj;

const days = Array.from({ length: 30 }, (_, i) => {
  const requests = 20 + ((i * 37) % 40);
  const completed = Math.round(requests * 0.55);
  return {
    key: String(i),
    label: `${(i % 28) + 13} Feb`,
    values: [completed, requests - completed],
    title: `${requests} requests, ${completed} completed`,
  };
});

export const BookingsPerDay: Story = {
  render: () => (
    <Card className="max-w-[760px]">
      <CardHeader
        title="Bookings per day"
        subtitle="Requests received and how many were completed"
        actions={
          <ChartLegend
            items={[
              { label: "Requests", className: "bg-brand" },
              { label: "Completed", className: "bg-gold" },
            ]}
          />
        }
      />
      <div className="px-[18px] py-4">
        <StackedBarChart ariaLabel="Bookings per day" data={days} segmentClasses={["bg-gold", "bg-brand"]} />
      </div>
    </Card>
  ),
};

export const BookingsByStatus: Story = {
  render: () => (
    <Card className="max-w-[400px] px-[18px] py-4">
      <StatBarList
        items={[
          { key: "c", label: "Completed", value: "9,412", percent: 95.4, barClass: "bg-blue" },
          { key: "a", label: "Accepted", value: "186", percent: 1.9, barClass: "bg-green" },
          { key: "d", label: "Declined", value: "148", percent: 1.5, barClass: "bg-red" },
          { key: "p", label: "Pending", value: "23", percent: 0.3, barClass: "bg-amber" },
        ]}
      />
    </Card>
  ),
};

export const Kpis: Story = {
  render: () => (
    <div className="grid max-w-[1100px] gap-3 sm:grid-cols-4">
      <KpiTile label="Bookings" value="1,284" delta={12} deltaLabel="vs February" />
      <KpiTile label="Booking value" value="18.4M DA" delta={8} deltaLabel="vs February" tone="green" />
      <KpiTile label="New users" value="612" delta={18} deltaLabel="vs February" tone="blue" />
      <KpiTile label="Average rating" value="4.6 / 5" delta={-2.1} deltaLabel="vs February" tone="gold" />
    </div>
  ),
};

export const RangePopover: Story = {
  render: function Render() {
    const [value, setValue] = useState("30d");
    return (
      <DateRangePopover
        presets={[
          { value: "today", label: "Today" },
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
          { value: "this_month", label: "This month" },
          { value: "custom", label: "Custom range" },
        ]}
        value={value}
        label={value}
        onChange={(p) => setValue(p)}
      />
    );
  },
};

/** SHL-02 trigger without the API (count only). */
export const Notifications: Story = {
  render: () => (
    <div className="flex justify-end">
      <NotificationPanel count={5} />
    </div>
  ),
};

/** SHL-01 shell (results need the API). */
export const GlobalSearch: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open search (Ctrl K)</Button>
        <CommandPalette open={open} onOpenChange={setOpen} />
      </>
    );
  },
};
