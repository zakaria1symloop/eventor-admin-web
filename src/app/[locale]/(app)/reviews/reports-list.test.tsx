import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { reportsQuery, type ReportRow } from "@/lib/api/reviews";
import { ReportsList } from "./reports-list";

vi.mock("@/i18n/navigation", () => ({
  // Forward the props: menu items render the Link `asChild` (role="menuitem" comes from Radix).
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reviews",
}));

const listReports = vi.fn();
vi.mock("@/lib/api/reviews", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/reviews")>()),
  listReports: (...a: unknown[]) => listReports(...a),
}));
const getUser = vi.fn();
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getUser: (...a: unknown[]) => getUser(...a),
}));
vi.mock("@/lib/api/saved-views", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/saved-views")>()),
  savedViewsSource: () => undefined,
}));

const target = (over: Partial<ReportRow["target"]>): ReportRow["target"] => ({
  label: "",
  href: null,
  reviewId: null,
  conversationId: null,
  bookingId: null,
  bookingReference: null,
  exists: true,
  ...over,
});
const row = (over: Partial<ReportRow>): ReportRow => ({
  id: "r1",
  targetType: "user",
  targetId: "u1",
  target: target({}),
  reason: "fake",
  note: null,
  reporter: null,
  status: "open",
  createdAt: "2026-11-20T10:00:00.000Z",
  resolvedBy: null,
  resolvedAt: null,
  resolutionNote: null,
  disputeId: null,
  disputeReference: null,
  ...over,
});
const ROWS = [
  row({
    id: "r1",
    target: target({ label: "Amina Zerrouki (Beauty by Amina) · provider", href: "/users/u1" }),
  }),
  row({
    id: "r2",
    targetType: "service",
    targetId: "s1",
    target: target({ label: "Deleted service", href: null, exists: false }),
  }),
];

describe("BUG-H3 reports queue", () => {
  beforeEach(() => {
    listReports.mockReset();
    getUser.mockReset();
    listReports.mockResolvedValue({
      data: ROWS,
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        counts: { open: 2, resolved: 0, dismissed: 0, all: 2 },
      },
    });
  });

  it("maps ?aboutUser= to aboutUserId, alongside the repeated targetType", () => {
    expect(
      reportsQuery({ tab: "open", sort: "", filters: { aboutUser: "u1", targetType: ["user", "pack"] } }),
    ).toMatchObject({ tab: "open", aboutUserId: "u1", targetType: ["user", "pack"] });
    expect(reportsQuery({ tab: "open", sort: "", filters: {} }).aboutUserId).toBeUndefined();
  });

  it("lists every type, filters on the account from a profile and names it in the chip", async () => {
    getUser.mockResolvedValue({ id: "u1", fullName: "Amina Zerrouki" });
    renderWithProviders(
      <ReportsList onOpenReview={() => undefined} exportOpen={false} onExportOpenChange={() => undefined} />,
      { searchParams: "?view=reports&aboutUser=u1" },
    );
    expect(await screen.findByText("Amina Zerrouki (Beauty by Amina) · provider")).toHaveAttribute(
      "href",
      "/users/u1",
    );
    expect(screen.getByText("Deleted service")).toBeInTheDocument();
    await waitFor(() =>
      expect(listReports).toHaveBeenCalledWith(expect.objectContaining({ aboutUserId: "u1" })),
    );
    expect(await screen.findByText(/Amina Zerrouki$/)).toBeInTheDocument(); // filter chip
  });

  it("hides 'Go to target' when the target is gone, keeps Resolve / Dismiss", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReportsList onOpenReview={() => undefined} exportOpen={false} onExportOpenChange={() => undefined} />,
    );
    await screen.findByText("Deleted service");
    const menus = screen.getAllByRole("button", { name: "Row actions" });

    await user.click(menus[0]);
    let menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Go to target" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(menus[1]);
    menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Go to target" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Resolve" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Dismiss" })).toBeInTheDocument();
  });
});
