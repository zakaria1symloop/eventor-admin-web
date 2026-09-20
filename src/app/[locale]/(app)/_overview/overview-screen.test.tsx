import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { overviewQuery, type Overview } from "@/lib/api/overview";
import { renderWithProviders } from "@/test/render";
import { overviewCsv, OverviewScreen } from "./overview-screen";

const getOverview = vi.fn();
vi.mock("@/lib/api/overview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/overview")>()),
  getOverview: (...a: unknown[]) => getOverview(...a),
}));
vi.mock("@/lib/auth/use-session", () => ({
  useSession: () => ({ data: { fullName: "Sara Meziane" } }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const data: Overview = {
  range: "7d",
  period: { from: "2026-09-10", to: "2026-09-16" },
  previousPeriod: { from: "2026-09-03", to: "2026-09-09" },
  attention: {
    verificationsWaiting: 14,
    oldestVerificationWaitingHours: 52,
    bookingsNoReply: 23,
    disputesOpen: 4,
    academicRequestsPending: 6,
    reviewsReported: 3,
    servicesReported: 5,
  },
  kpis: [
    { key: "bookings", value: "1284", previousValue: "1146", deltaPercent: 12 },
    { key: "booking_value", value: "18400000.00", previousValue: "17000000.00", deltaPercent: 8.2 },
    { key: "new_users", value: "612", previousValue: "518", deltaPercent: 18.1 },
    { key: "average_rating", value: "4.60", previousValue: "4.70", deltaPercent: -2.1 },
  ],
  bookingsPerDay: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-09-1${i}`,
    requests: 10 + i,
    completed: 4,
  })),
  bookingsByStatus: [
    { status: "completed", count: 9412, percent: 95.4 },
    { status: "pending", count: 23, percent: 0.3 },
  ],
  latestBookings: [],
  recentActivity: [],
  generatedAt: "2026-09-16T10:00:00.000Z",
};

describe("overview range (OVR-01)", () => {
  it("maps the URL range to the API query", () => {
    expect(overviewQuery(null)).toEqual({ range: "30d" });
    expect(overviewQuery("today")).toEqual({ range: "today" });
    expect(overviewQuery("this_month")).toEqual({ range: "this_month" });
    expect(overviewQuery("custom", "2026-08-01", "2026-08-31")).toEqual({
      range: "custom",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    // Custom without both days and unknown values fall back to the default.
    expect(overviewQuery("custom", "2026-08-01", null)).toEqual({ range: "30d" });
    expect(overviewQuery("year")).toEqual({ range: "30d" });
  });

  it("exports the figures as CSV", () => {
    const csv = overviewCsv(data, { kpi: (k) => k, status: (s) => s });
    expect(csv).toContain("bookings,1284,1146,12");
    expect(csv).toContain("2026-09-10,10,4");
    expect(csv).toContain("completed,9412,95.4");
  });
});

describe("OverviewScreen", () => {
  beforeEach(() => getOverview.mockReset().mockResolvedValue(data));

  it("requests the range from the URL and renders the attention queue, KPIs and charts", async () => {
    renderWithProviders(<OverviewScreen />, { searchParams: "?range=7d" });
    await waitFor(() => expect(getOverview).toHaveBeenCalledWith({ range: "7d" }));
    expect(await screen.findByText("Accounts to verify")).toBeInTheDocument();
    expect(screen.getByText("Oldest waiting 2 days")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bookings without a reply/ })).toHaveAttribute(
      "href",
      "/bookings?noReply=true",
    );
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("4.6 / 5")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart-bar")).toHaveLength(7);
    expect(screen.getByRole("button", { name: /Last 7 days/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Sara/);
  });

  it("sends custom dates", async () => {
    renderWithProviders(<OverviewScreen />, { searchParams: "?range=custom&from=2026-08-01&to=2026-08-31" });
    await waitFor(() =>
      expect(getOverview).toHaveBeenCalledWith({ range: "custom", from: "2026-08-01", to: "2026-08-31" }),
    );
  });
});
