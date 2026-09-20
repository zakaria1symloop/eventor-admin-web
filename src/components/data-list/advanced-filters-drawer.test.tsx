import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { fetchMockUsers, type MockUser } from "@/mocks/users";
import { DataList } from "./data-list";
import type { AdvancedFilterField } from "./advanced-filters-drawer";
import type { ListParams } from "./use-list-state";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const advanced: AdvancedFilterField[] = [
  {
    key: "category",
    label: "Service category",
    type: "multiselect",
    options: [
      { value: "venue", label: "Venue" },
      { value: "photography", label: "Photography" },
    ],
  },
  {
    key: "rating",
    label: "Rating",
    type: "segmented",
    options: [
      { value: "4", label: "4.0+" },
      { value: "4.5", label: "4.5+" },
    ],
  },
  { key: "bookings", label: "Completed bookings", type: "range" },
  { key: "hasDocs", label: "Has documents", type: "toggle" },
];

function setup(searchParams = "") {
  const updates: UrlUpdateEvent[] = [];
  const queryFn = vi.fn((params: ListParams) => fetchMockUsers(params, { delay: 0 }));
  const countFn = vi.fn(async (params: ListParams) => 100 + Object.keys(params.filters).length);
  renderWithProviders(
    <DataList<MockUser>
      resource={["users-adv"]}
      queryFn={queryFn}
      countFn={countFn}
      columns={[{ id: "name", header: "User", cell: (u) => u.name }]}
      getRowId={(u) => u.id}
      advancedFilters={advanced}
      itemLabel="users"
    />,
    { searchParams, onUrlUpdate: (e) => updates.push(e) },
  );
  const lastQuery = () => decodeURIComponent(updates.at(-1)?.queryString ?? "");
  return { queryFn, countFn, lastQuery };
}

describe("AdvancedFiltersDrawer URL sync", () => {
  it("reads values from the URL, applies draft changes to the URL with a live count", async () => {
    const u = userEvent.setup();
    const { queryFn, countFn, lastQuery } = setup("?rating=4&bookings=10..");
    await waitFor(() => expect(queryFn).toHaveBeenCalled());
    expect(queryFn.mock.calls.at(-1)?.[0].filters).toEqual({ rating: "4", bookings: "10.." });

    // chips for URL values
    expect(screen.getByText("≥ 10")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /More filters/ }));
    const drawer = await screen.findByRole("dialog", { name: "Filters" });
    expect(within(drawer).getByRole("radio", { name: "4.0+" })).toHaveAttribute("aria-checked", "true");
    expect(within(drawer).getByRole("textbox", { name: "Completed bookings minimum" })).toHaveValue("10");

    await u.click(within(drawer).getByRole("checkbox", { name: "Venue" }));
    await u.click(within(drawer).getByRole("switch", { name: "Has documents" }));
    await u.click(within(drawer).getByRole("radio", { name: "Any" }));

    // live count for the draft (category + bookings + hasDocs = 3 filters)
    await waitFor(() =>
      expect(within(drawer).getByRole("button", { name: "Show 103 users" })).toBeInTheDocument(),
    );
    expect(countFn.mock.lastCall?.[0].filters).toEqual({
      bookings: "10..",
      category: ["venue"],
      hasDocs: "true",
    });

    await u.click(within(drawer).getByRole("button", { name: "Show 103 users" }));
    await waitFor(() => expect(lastQuery()).toContain("category=venue"));
    expect(lastQuery()).toContain("hasDocs=true");
    expect(lastQuery()).toContain("bookings=10..");
    expect(lastQuery()).not.toContain("rating=");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Clear all in the drawer removes every advanced filter from the URL", async () => {
    const u = userEvent.setup();
    const { lastQuery } = setup("?category=venue,photography&hasDocs=true");
    await u.click(await screen.findByRole("button", { name: /More filters/ }));
    const drawer = await screen.findByRole("dialog", { name: "Filters" });
    // chips row + footer both offer "Clear all"; use the footer one
    expect(within(drawer).getByRole("button", { name: "Remove filter Has documents" })).toBeInTheDocument();
    await u.click(within(drawer).getAllByRole("button", { name: "Clear all" }).at(-1)!);
    expect(
      within(drawer).queryByRole("button", { name: "Remove filter Has documents" }),
    ).not.toBeInTheDocument();
    await u.click(within(drawer).getByRole("button", { name: /^Show/ }));
    await waitFor(() => expect(lastQuery()).not.toContain("category"));
    expect(lastQuery()).not.toContain("hasDocs");
  });
});
