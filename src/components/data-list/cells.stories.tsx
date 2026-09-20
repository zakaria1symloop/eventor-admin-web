import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Camera, Sparkles } from "lucide-react";
import { useState } from "react";
import { UserCell } from "./cells";
import {
  BilingualCell,
  CountLinkCell,
  DragHandleCell,
  EntityCell,
  LinkCell,
  MoneyCell,
  RatingCell,
  StackCell,
  StatusBadgeCell,
  ToggleCell,
} from "./cells-extended";

const meta: Meta = { title: "Lists/Cell renderers" };
export default meta;
type Story = StoryObj;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border">
      <th className="w-44 px-4 py-3 text-start text-12 font-medium text-muted">{label}</th>
      <td className="px-4 py-3">{children}</td>
    </tr>
  );
}

function Cells() {
  const [shown, setShown] = useState(true);
  return (
    <table className="w-full max-w-[720px] rounded-xl bg-surface text-14">
      <tbody>
        <Row label="UserCell">
          <UserCell name="Karim Belkacem" sub="Studio Lumière · Photography" href="/users/1" />
        </Row>
        <Row label="EntityCell">
          <EntityCell
            icon={<Camera />}
            title="Wedding photo & video coverage"
            sub="Photography · from 45 000 DA"
            href="/services/1"
          />
        </Row>
        <Row label="EntityCell (no href)">
          <EntityCell icon={<Sparkles />} title="Photo booth corner" sub="Decor" />
        </Row>
        <Row label="LinkCell">
          <LinkCell label="#EVT-2041" href="/bookings/2041" sub="Wedding photo & video coverage" />
        </Row>
        <Row label="StackCell">
          <StackCell primary="14 Mar 2026" secondary="18:00 – 23:00" />
        </Row>
        <Row label="MoneyCell">
          <MoneyCell value="45000.00" sub="Saves 5 000 DA" subTone="green" />
        </Row>
        <Row label="MoneyCell (cents)">
          <MoneyCell value="1250.50" />
        </Row>
        <Row label="RatingCell">
          <RatingCell value={4.8} count={32} />
        </Row>
        <Row label="RatingCell (none)">
          <RatingCell value={null} />
        </Row>
        <Row label="StatusBadgeCell">
          <StatusBadgeCell domain="service" status="waiting_approval" />
        </Row>
        <Row label="CountLinkCell">
          <div className="flex gap-6">
            <CountLinkCell count={31} href="/bookings?service=1" label={(n) => `${n} bookings`} />
            <CountLinkCell count={0} href="/bookings?service=2" label={(n) => `${n} bookings`} />
          </div>
        </Row>
        <Row label="ToggleCell (confirm when hiding)">
          <ToggleCell
            label="Shown in app"
            checked={shown}
            onChange={async (next) => {
              await new Promise((r) => setTimeout(r, 500));
              setShown(next);
            }}
            confirm={(next) =>
              next
                ? null
                : {
                    title: "Hide Photography?",
                    description: "10 services use this category.",
                    impact: ["Not selectable for new services"],
                    confirmLabel: "Hide category",
                    tone: "warning",
                  }
            }
            successMessage={(next) => (next ? "Category shown" : "Category hidden")}
          />
        </Row>
        <Row label="BilingualCell">
          <BilingualCell en="Photography" ar="تصوير فوتوغرافي" />
        </Row>
        <Row label="BilingualCell (missing)">
          <BilingualCell en="Flowers" ar={null} onMissingClick={() => {}} />
        </Row>
        <Row label="DragHandleCell">
          <DragHandleCell />
        </Row>
      </tbody>
    </table>
  );
}

export const AllCells: Story = { render: () => <Cells /> };
export const AllCellsRTL: Story = { render: () => <Cells />, globals: { locale: "ar" } };
