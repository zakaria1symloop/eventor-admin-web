import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { ActivityLogDetail } from "@/lib/api/activity-log";
import { LogEntryDrawer } from "./log-entry-drawer";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const entry: ActivityLogDetail = {
  id: "e1",
  createdAt: "2026-11-25T10:00:00.000Z",
  actor: null,
  actorRole: null,
  action: "booking.status_changed",
  objectType: "booking",
  objectId: "b1",
  objectLabel: "EVT-002030",
  level: "info",
  source: "system",
  ip: null,
  hasChanges: true,
  hasNote: false,
  changes: { status: { from: "pending", to: "cancelled" }, cancelledBy: { from: null, to: "system" } },
  note: null,
  userAgent: null,
  requestId: null,
  object: { type: "booking", id: "b1", label: "EVT-002030" },
};
vi.mock("@/lib/api/activity-log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/activity-log")>()),
  getActivityLogEntry: () => Promise.resolve(entry),
}));

describe("BUG-H4/M3 who cancelled, in the activity log", () => {
  it("shows cancelledBy `system` as “Eventor (automatic)”, other values unchanged", async () => {
    renderWithProviders(<LogEntryDrawer id="e1" onClose={() => undefined} />);
    expect(await screen.findByText("Eventor (automatic)")).toBeInTheDocument();
    expect(screen.queryByText("system")).not.toBeInTheDocument();
    expect(screen.getByText("cancelled")).toBeInTheDocument(); // other fields stay raw
  });

  it("in Arabic", async () => {
    renderWithProviders(<LogEntryDrawer id="e1" onClose={() => undefined} />, { locale: "ar" });
    expect(await screen.findByText("إيفنتور (تلقائيًا)")).toBeInTheDocument();
  });
});
