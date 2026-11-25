import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api/errors";
import { SavedViewsMenu, type SavedView } from "./list-extras";

const mine: SavedView = {
  id: "v1",
  name: "Blocked providers",
  query: { status: "blocked" },
  isShared: false,
  isMine: true,
};
const shared: SavedView = {
  id: "v2",
  name: "Team view",
  query: { tab: "providers" },
  isShared: true,
  isMine: false,
  ownerName: "Sara Meziane",
};

type Rename = (view: SavedView, name: string) => Promise<unknown>;

function setup(over: { onRename?: Rename } = {}) {
  const onApply = vi.fn();
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onRename: Rename = over.onRename ?? vi.fn<Rename>().mockResolvedValue(undefined);
  renderWithProviders(
    <SavedViewsMenu
      source={{ queryKey: ["views-test"], queryFn: async () => [mine, shared], onDelete, onRename }}
      onApply={onApply}
      onSaveCurrent={() => undefined}
    />,
  );
  return { onApply, onDelete, onRename };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Views" }));
  return screen.findByRole("menu");
}

describe("BUG-L1 saved views", () => {
  it("the trash asks to delete instead of applying the view, then deletes", async () => {
    const user = userEvent.setup();
    const { onApply, onDelete } = setup();
    const menu = await openMenu(user);
    await user.click(await within(menu).findByRole("button", { name: "Delete view Blocked providers" }));
    expect(onApply).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Delete the view “Blocked providers”?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete view" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(mine));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("renames a view, and says when the name is taken", async () => {
    const user = userEvent.setup();
    const onRename = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 409, code: "SAVED_VIEW_NAME_TAKEN", message: "taken" }))
      .mockResolvedValueOnce(undefined);
    const { onApply } = setup({ onRename });
    const menu = await openMenu(user);
    await user.click(await within(menu).findByRole("button", { name: "Rename view Blocked providers" }));
    expect(onApply).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Rename view" });
    const input = within(dialog).getByRole("textbox");
    expect(input).toHaveValue("Blocked providers");
    await user.clear(input);
    await user.type(input, "Team view");
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));
    expect(
      await within(dialog).findByText("You already have a view with this name in this list."),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "Blocked (all)");
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(onRename).toHaveBeenLastCalledWith(mine, "Blocked (all)"));
  });

  it("offers no rename or delete on another admin's view, and a click on a row still applies it", async () => {
    const user = userEvent.setup();
    const { onApply } = setup();
    const menu = await openMenu(user);
    const sharedRow = (await within(menu).findAllByRole("menuitem")).find((i) =>
      i.textContent?.includes("Team view"),
    )!;
    expect(within(sharedRow).queryByRole("button")).not.toBeInTheDocument();
    await user.click(sharedRow);
    expect(onApply).toHaveBeenCalledWith(shared);
  });
});
