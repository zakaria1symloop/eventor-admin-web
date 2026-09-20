import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Invoice } from "@/lib/api/bookings";
import { Card } from "@/components/ui/card";
import { Composer, MessageBubble } from "./chat";
import { HistoryList } from "./history-list";
import { InvoiceDocument } from "./invoice-document";
import { PriceSummary } from "./price-summary";
import { StatusTimeline } from "./status-timeline";

const meta: Meta = { title: "Domain/Bookings & messages" };
export default meta;
type Story = StoryObj;

export const Timeline: Story = {
  render: () => (
    <Card className="max-w-[1100px] px-[18px] py-4">
      <StatusTimeline
        steps={[
          { key: "r", label: "Requested", sub: "12 Mar · 18:40", state: "done" },
          { key: "w", label: "Waiting for provider", sub: "Since 52 h · reminder sent 13 Mar", state: "now" },
          { key: "d", label: "Accepted or declined", sub: "Provider decides", state: "next" },
          { key: "e", label: "Event day", sub: "02 Apr 2026", state: "next" },
          { key: "c", label: "Completed & reviewed", sub: "Client can leave a review", state: "next" },
        ]}
      />
    </Card>
  ),
};

export const TimelineDeclined: Story = {
  render: () => (
    <Card className="max-w-[1100px] px-[18px] py-4">
      <StatusTimeline
        steps={[
          { key: "r", label: "Requested", state: "done" },
          { key: "w", label: "Waiting for provider", state: "done" },
          { key: "d", label: "Declined", sub: "13 Mar · 09:10", state: "failed" },
          { key: "e", label: "Event day", state: "next" },
        ]}
      />
    </Card>
  ),
};

export const Price: Story = {
  render: () => (
    <Card className="max-w-[370px]">
      <PriceSummary
        lines={[
          { key: "1", label: "Service price", amount: "45000.00" },
          { key: "2", label: "Henna evening (extra)", amount: "12000.00" },
          { key: "3", label: "Discount", amount: "-2000.00" },
        ]}
        total="55000.00"
        feePercent="10.00"
        feeAmount="5500.00"
        providerAmount="49500.00"
      />
    </Card>
  ),
};

export const Messages: Story = {
  render: () => (
    <Card className="flex max-w-[640px] flex-col gap-3 p-5">
      <MessageBubble
        message={{
          id: "1",
          kind: "text",
          senderLabel: "Karima Ait",
          side: "start",
          body: "Hello, we have to cancel the DJ set for the 7th.",
          status: "visible",
          createdAt: "2026-03-13T18:02:00Z",
        }}
      />
      <MessageBubble
        onModerate={() => undefined}
        message={{
          id: "2",
          kind: "text",
          senderLabel: "DJ Amine",
          side: "end",
          body: "Call me on 0555 12 34 56, you will pay double.",
          bodyMasked: "Call me on [phone hidden], you will pay double.",
          masked: true,
          reportsOpen: 1,
          status: "visible",
          createdAt: "2026-03-13T18:21:00Z",
        }}
      />
      <MessageBubble
        onModerate={() => undefined}
        message={{
          id: "3",
          kind: "text",
          senderLabel: "DJ Amine",
          side: "end",
          body: "Hidden by an admin",
          status: "hidden",
          createdAt: "2026-03-13T18:25:00Z",
        }}
      />
      <MessageBubble
        message={{
          id: "4",
          kind: "system",
          senderLabel: "Eventor",
          body: "Sara Meziane joined the conversation as Eventor support",
          status: "visible",
          createdAt: "2026-03-14T09:05:00Z",
        }}
      />
      <Composer
        onSend={async () => undefined}
        placeholder="Write as Eventor support · both people will see it"
      />
    </Card>
  ),
};

export const History: Story = {
  render: () => (
    <Card className="max-w-[370px] p-5">
      <HistoryList
        items={[
          { key: "1", title: "Automatic reminder sent to provider", meta: "System · 14 Mar 09:15" },
          { key: "2", title: "Booking requested · 45 000 DA", meta: "Sofiane Brahimi · 12 Mar 18:40" },
        ]}
      />
    </Card>
  ),
};

const invoice: Invoice = {
  id: "i1",
  bookingId: "b1",
  bookingReference: "EVT-002030",
  number: "INV-2026-0318",
  version: 1,
  issuedAt: "2026-03-14T09:00:00Z",
  currency: "DZD",
  issuer: {
    name: "Eventor (Symloop SARL)",
    address: "Cité 1er Novembre, Bab Ezzouar, Alger",
    nif: "001216099999999",
    rc: "16/00-1234567B21",
    email: "billing@eventor.dz",
    phone: "+213 23 00 00 00",
  },
  client: { id: "c1", name: "Sofiane Brahimi", businessName: null, email: "s@x.dz", phone: "+213661000000" },
  provider: { id: "p1", name: "Karim Belkacem", businessName: "Studio Lumière", email: null, phone: null },
  titleEn: "Wedding photo & video coverage",
  titleAr: "تغطية الزفاف",
  eventDate: "2026-04-02",
  eventType: "wedding",
  lines: [
    {
      kind: "service",
      label: "Wedding photo & video coverage",
      quantity: 1,
      unitAmount: "45000.00",
      amount: "45000.00",
    },
    {
      kind: "extra",
      label: "Henna evening (extra)",
      quantity: 1,
      unitAmount: "12000.00",
      amount: "12000.00",
    },
    { kind: "discount", label: "Discount", quantity: 1, unitAmount: "2000.00", amount: "-2000.00" },
  ],
  subtotal: "57000.00",
  discountTotal: "2000.00",
  total: "55000.00",
  feePercent: "10.00",
  feeAmount: "5500.00",
  providerAmount: "49500.00",
  pdfReady: true,
  sentToClientAt: null,
  versions: [1],
};

export const InvoicePreview: Story = {
  render: () => (
    <Card className="max-w-[640px] p-6">
      <InvoiceDocument invoice={invoice} />
    </Card>
  ),
};

export const InvoiceArabic: Story = {
  globals: { locale: "ar" },
  render: InvoicePreview.render,
};
