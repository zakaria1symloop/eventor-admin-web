import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@/lib/api/overview";
import { renderWithProviders } from "@/test/render";
import { CommandPalette, loadRecentSearches } from "./command-palette";

const push = vi.fn();
const search = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/lib/api/overview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/overview")>()),
  search: (...a: unknown[]) => search(...a),
}));

const karim: SearchResult = {
  q: "karim",
  exactMatch: null,
  groups: [
    {
      type: "users",
      items: [
        {
          id: "u1",
          title: "Karim Belkacem",
          subtitle: "Provider · Studio Lumière",
          href: "/users/u1",
          badge: null,
        },
        { id: "u2", title: "Karima Ait", subtitle: "Client · Alger", href: "/users/u2", badge: null },
      ],
    },
    {
      type: "services",
      items: [
        { id: "s1", title: "Wedding photo", subtitle: "Studio Lumière", href: "/services/s1", badge: null },
      ],
    },
    { type: "bookings", items: [] },
  ],
};

function renderPalette(onOpenChange = vi.fn()) {
  return renderWithProviders(<CommandPalette open onOpenChange={onOpenChange} debounceMs={0} />);
}

describe("CommandPalette (SHL-01)", () => {
  beforeEach(() => {
    push.mockReset();
    search.mockReset();
    window.localStorage.clear();
  });

  it("groups results and moves the active option with the arrow keys", async () => {
    const user = userEvent.setup();
    search.mockResolvedValue(karim);
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);
    const input = screen.getByRole("combobox");
    await user.type(input, "karim");
    expect(await screen.findByText("Karim Belkacem")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Services" })).toBeInTheDocument();
    // Empty groups are not rendered.
    expect(screen.queryByRole("group", { name: "Bookings" })).not.toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1].id);

    await user.keyboard("{Enter}");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/users/u2"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(loadRecentSearches()).toEqual(["karim"]);
  });

  it("jumps straight to the exact match on Enter, even before the debounced search returns", async () => {
    const user = userEvent.setup();
    search.mockImplementation(async (q: string) => ({
      q,
      exactMatch: { type: "booking", id: "b1", href: "/bookings/b1" },
      groups: [
        {
          type: "bookings",
          items: [{ id: "b9", title: "#EVT-002049", subtitle: null, href: "/bookings/b9", badge: "pending" }],
        },
      ],
    }));
    renderWithProviders(<CommandPalette open onOpenChange={vi.fn()} debounceMs={5_000} />);
    await user.type(screen.getByRole("combobox"), "EVT-002041{Enter}");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/b1"));
    expect(search).toHaveBeenCalledWith("EVT-002041", "all", 5, expect.anything());
  });

  it("Tab switches the scope and an empty result shows the no-results state", async () => {
    const user = userEvent.setup();
    search.mockResolvedValue({ q: "zzz", exactMatch: null, groups: [{ type: "users", items: [] }] });
    renderPalette();
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(await screen.findByText("No results for “zzz”")).toBeInTheDocument();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Users" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("zzz", "users", 10, expect.anything()));
  });

  it("shows recent searches when the box is empty", async () => {
    window.localStorage.setItem("eventor.admin.recentSearches", JSON.stringify(["amina", "EVT-002041"]));
    renderPalette();
    expect(await screen.findByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "amina" })).toBeInTheDocument();
  });
});
