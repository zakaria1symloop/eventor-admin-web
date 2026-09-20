import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { fetchMockUsers, type MockUser } from "@/mocks/users";
import { DataList } from "./data-list";
import type { DataColumn } from "./data-table";
import type { ListParams } from "./use-list-state";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const columns: DataColumn<MockUser>[] = [
  { id: "name", header: "User", sortable: true, cell: (u) => u.name },
  { id: "wilaya", header: "Wilaya", cell: (u) => u.wilaya },
];

function setup(searchParams = "") {
  const updates: UrlUpdateEvent[] = [];
  const queryFn = vi.fn((params: ListParams) => fetchMockUsers(params, { delay: 0 }));
  const utils = renderWithProviders(
    <DataList<MockUser>
      resource={["users-test"]}
      queryFn={queryFn}
      columns={columns}
      getRowId={(u) => u.id}
      tabs={[
        { key: "all", label: "All" },
        { key: "providers", label: "Providers" },
      ]}
      filters={[
        {
          key: "wilaya",
          label: "Wilaya",
          options: [
            { value: "Alger", label: "Alger" },
            { value: "Oran", label: "Oran" },
          ],
        },
      ]}
      searchPlaceholder="Search users"
      bulkActions={(selected) => <button type="button">Block {selected.length}</button>}
    />,
    { searchParams, onUrlUpdate: (e) => updates.push(e) },
  );
  const lastQuery = () => updates.at(-1)?.queryString ?? "";
  return { ...utils, queryFn, updates, lastQuery };
}

describe("DataList URL sync", () => {
  it("reads initial state from the URL and passes it to queryFn", async () => {
    const { queryFn } = setup("?q=karim&page=1&limit=20&sort=name:asc&tab=providers&wilaya=Alger");
    await waitFor(() => expect(queryFn).toHaveBeenCalled());
    expect(queryFn.mock.calls.at(-1)?.[0]).toEqual({
      q: "karim",
      page: 1,
      limit: 20,
      sort: "name:asc",
      tab: "providers",
      filters: { wilaya: "Alger" },
    });
    expect(await screen.findByText("Karim Belkacem")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("karim");
  });

  it("writes search (debounced), sort, tab, page and filters to the URL", async () => {
    const user = userEvent.setup();
    const { lastQuery, updates } = setup();
    await screen.findByText("Amina Benali");

    // debounced search
    await user.type(screen.getByRole("searchbox"), "amina");
    expect(updates.some((u) => u.queryString.includes("q="))).toBe(false);
    await waitFor(() => expect(lastQuery()).toContain("q=amina"), { timeout: 1500 });

    // clear search, then paginate
    await user.clear(screen.getByRole("searchbox"));
    await waitFor(() => expect(lastQuery()).not.toContain("q="), { timeout: 1500 });
    await screen.findByRole("button", { name: "Page 2" });
    await user.click(screen.getByRole("button", { name: "Page 2" }));
    await waitFor(() => expect(lastQuery()).toContain("page=2"));

    // sortable header resets page
    await user.click(screen.getByRole("button", { name: /User/ }));
    await waitFor(() => expect(lastQuery()).toContain("sort=name:asc"));
    expect(lastQuery()).not.toContain("page=");

    // tabs
    await user.click(screen.getByRole("tab", { name: "Providers" }));
    await waitFor(() => expect(lastQuery()).toContain("tab=providers"));

    // filter select
    await user.click(screen.getByRole("button", { name: /Wilaya/ }));
    await user.click(await screen.findByRole("option", { name: "Oran" }));
    await waitFor(() => expect(lastQuery()).toContain("wilaya=Oran"));
  });

  it("shows the bulk bar for selected rows and a no-results state with clear all", async () => {
    const user = userEvent.setup();
    const { lastQuery } = setup("?q=zzzz-nobody");
    expect(await screen.findByText("No results match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    await waitFor(() => expect(lastQuery()).not.toContain("q="));

    const rows = await screen.findAllByRole("checkbox", { name: "Select row" });
    await act(async () => {
      await user.click(rows[0]);
      await user.click(rows[1]);
    });
    const bar = screen.getByRole("region", { name: "2 selected" });
    expect(within(bar).getByRole("button", { name: "Block 2" })).toBeInTheDocument();
  });
});
