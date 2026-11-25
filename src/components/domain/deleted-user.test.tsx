import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api/client";
import { getUser, usersQuery } from "@/lib/api/users";
import { PersonCell } from "./deleted-user";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

afterEach(() => vi.restoreAllMocks());

describe("BUG-M5 deleted accounts", () => {
  it("a person links to the profile, or — once deleted — shows the name with a badge and no link", () => {
    const { rerender } = renderWithProviders(
      <PersonCell label="Sofia Guerfi" href="/users/u1" sub="Client" />,
    );
    expect(screen.getByRole("link", { name: "Sofia Guerfi" })).toHaveAttribute("href", "/users/u1");
    rerender(<PersonCell label="Sofia Guerfi" href="/users/u1" sub="Client" deleted />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Sofia Guerfi")).toBeInTheDocument();
    expect(screen.getByText("Deleted user")).toBeInTheDocument();
  });

  it("the users list asks for deleted accounts only with the opt-in filter", () => {
    expect(usersQuery({ q: "", tab: "all", sort: "", filters: { deleted: "true" } }).includeDeleted).toBe(
      true,
    );
    expect(usersQuery({ q: "", tab: "all", sort: "", filters: {} }).includeDeleted).toBeUndefined();
  });

  it("getUser sends includeDeleted only when asked", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { id: "u1" } });
    await getUser("u1");
    expect(get).toHaveBeenLastCalledWith("/admin/users/u1", { query: undefined });
    await getUser("u1", { includeDeleted: true });
    expect(get).toHaveBeenLastCalledWith("/admin/users/u1", { query: { includeDeleted: true } });
  });
});
