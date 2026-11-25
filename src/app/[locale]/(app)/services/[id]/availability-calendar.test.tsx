import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { dayBlockSource, dayStatusKey, itemKindKey, type AvailabilityBlock } from "@/lib/api/services";
import { AvailabilityCalendar, monthKey } from "./availability-calendar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const getAvailability = vi.fn();
vi.mock("@/lib/api/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/services")>()),
  getAvailability: (...a: unknown[]) => getAvailability(...a),
}));

const block = (over: Partial<AvailabilityBlock>): AvailabilityBlock => ({
  id: "b1",
  kind: "blocked",
  date: "2030-01-10",
  startTime: null,
  endTime: null,
  service: null,
  booking: null,
  note: null,
  removable: true,
  source: "provider",
  ...over,
});

describe("BUG-F6 / BUG-M1 who blocked a day", () => {
  it("names the source when every manual block of the day shares it", () => {
    const admin = block({ source: "admin" });
    const provider = block({ id: "b2" });
    expect(dayBlockSource({ items: [admin] })).toBe("admin");
    expect(dayBlockSource({ items: [admin, provider] })).toBe("mixed");
    expect(dayBlockSource({ items: [block({ kind: "booked" })] })).toBeNull();
    expect(dayStatusKey({ status: "blocked", items: [admin] })).toBe("status.blockedByEventor");
    expect(dayStatusKey({ status: "blocked", items: [provider] })).toBe("status.blockedByProvider");
    expect(dayStatusKey({ status: "blocked", items: [admin, provider] })).toBe("status.blocked");
    expect(dayStatusKey({ status: "booked", items: [] })).toBe("status.booked");
    expect(itemKindKey(admin)).toBe("kind.blockedByEventor");
    expect(itemKindKey(provider)).toBe("kind.blockedByProvider");
    expect(itemKindKey(block({ kind: "held" }))).toBe("kind.held");
  });
});

describe("Availability calendar labels", () => {
  const month = monthKey(new Date());
  const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;

  beforeEach(() => {
    getAvailability.mockReset();
    getAvailability.mockResolvedValue({
      providerId: "p1",
      month,
      maxEventsPerDay: 1,
      days: [
        {
          date: day(20),
          status: "blocked",
          items: [block({ date: day(20), source: "admin", note: "Venue works" })],
        },
        { date: day(21), status: "blocked", items: [block({ id: "b2", date: day(21) })] },
      ],
    });
  });

  it("labels Eventor and provider blocks apart, and says the admin note stays internal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AvailabilityCalendar providerId="p1" />);
    expect(
      await screen.findByRole("gridcell", { name: `${day(20)} · Blocked by Eventor` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: `${day(21)} · Blocked by provider` })).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument(); // neutral legend

    await user.click(screen.getByRole("gridcell", { name: `${day(20)} · Blocked by Eventor` }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/^Blocked by Eventor ·/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Venue works/)).toBeInTheDocument();
    expect(within(dialog).getByText("Internal: the provider never sees this note.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove block" })).toBeInTheDocument();
  });
});
