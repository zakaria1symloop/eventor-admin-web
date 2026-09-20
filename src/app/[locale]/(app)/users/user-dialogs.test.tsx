import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { BlockUserDialog, DeleteUserDialog, type UserTarget } from "./user-dialogs";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const getBlockImpact = vi.fn();
const blockUser = vi.fn();
const deleteUser = vi.fn();
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getBlockImpact: (...args: unknown[]) => getBlockImpact(...args),
  blockUser: (...args: unknown[]) => blockUser(...args),
  deleteUser: (...args: unknown[]) => deleteUser(...args),
}));

const karim: UserTarget = { id: "u1", fullName: "Karim Belkacem", role: "provider", email: "k@x.dz" };

beforeEach(() => {
  getBlockImpact.mockReset();
  blockUser.mockReset();
  deleteUser.mockReset();
});

describe("USR-07 BlockUserDialog", () => {
  it("renders the live impact, requires a reason and sends the bookings choice", async () => {
    const user = userEvent.setup();
    getBlockImpact.mockResolvedValue({
      servicesCount: 5,
      packsCount: 1,
      pendingBookings: 3,
      upcomingBookings: 2,
      conversations: 17,
    });
    const result = { user: {}, impact: {}, cancelledBookings: 0, sessionsRevoked: 2 };
    blockUser.mockResolvedValue(result);
    const onBlocked = vi.fn();

    renderWithProviders(
      <BlockUserDialog user={karim} open onOpenChange={() => undefined} onBlocked={onBlocked} />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Block Karim Belkacem?" });
    expect(
      await within(dialog).findByText("5 services hidden from search and the profile"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("1 Ready Pack marked “Provider blocked”")).toBeInTheDocument();
    expect(within(dialog).getByText("17 conversations become read-only")).toBeInTheDocument();
    expect(within(dialog).getByText("3 pending and 2 upcoming bookings")).toBeInTheDocument();
    expect(getBlockImpact).toHaveBeenCalledWith("u1");

    // Reason is required.
    await user.click(within(dialog).getByRole("button", { name: "Block account" }));
    expect(await within(dialog).findByText("Pick a reason")).toBeInTheDocument();
    expect(blockUser).not.toHaveBeenCalled();

    await user.selectOptions(within(dialog).getByRole("combobox", { name: /Reason/ }), "no_shows");
    await user.click(within(dialog).getByRole("radio", { name: /Keep them/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Message to the user" }), "Contact support");
    await user.click(within(dialog).getByRole("button", { name: "Block account" }));

    await waitFor(() =>
      expect(blockUser).toHaveBeenCalledWith("u1", {
        reason: "no_shows",
        until: null,
        message: "Contact support",
        bookings: "keep",
      }),
    );
    expect(onBlocked).toHaveBeenCalledWith(result);
  });

  it("hides the bookings choice when nothing is pending and sends the duration", async () => {
    const user = userEvent.setup();
    getBlockImpact.mockResolvedValue({
      servicesCount: 0,
      packsCount: 0,
      pendingBookings: 0,
      upcomingBookings: 0,
      conversations: 0,
    });
    blockUser.mockResolvedValue({ cancelledBookings: 0 });
    const client: UserTarget = { id: "c1", fullName: "Amina Benali", role: "client" };
    renderWithProviders(<BlockUserDialog user={client} open onOpenChange={() => undefined} />);

    const dialog = await screen.findByRole("dialog", { name: "Block Amina Benali?" });
    expect(await within(dialog).findByText("Signed out on every device")).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: /Keep them/ })).not.toBeInTheDocument();

    await user.selectOptions(within(dialog).getByRole("combobox", { name: /Reason/ }), "fraud");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Duration" }), "7d");
    await user.click(within(dialog).getByRole("button", { name: "Block account" }));
    await waitFor(() => expect(blockUser).toHaveBeenCalled());
    const body = blockUser.mock.calls[0][1];
    expect(body).toMatchObject({ reason: "fraud", bookings: "keep", message: null });
    expect(new Date(body.until).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });
});

describe("USR-08 DeleteUserDialog", () => {
  it("needs the typed name and shows ACCOUNT_HAS_ACTIVE_ITEMS details", async () => {
    const user = userEvent.setup();
    deleteUser.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "ACCOUNT_HAS_ACTIVE_ITEMS",
        message: "This account has 2 accepted upcoming bookings and 1 open disputes. Resolve them first.",
        details: { upcomingBookings: 2, openDisputes: 1 },
      }),
    );
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <DeleteUserDialog
        user={karim}
        open
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
        linked={{ bookings: 48, services: 5, reviews: 32 }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete Karim Belkacem?" });
    expect(within(dialog).getByText("48 bookings · 5 services · 32 reviews linked")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Delete user" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Type Karim Belkacem to confirm"), "Karim Belk");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type Karim Belkacem to confirm"), "acem");
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(
      await within(dialog).findByText(
        "Can't delete yet: 2 upcoming bookings and 1 open dispute. Cancel or resolve them first.",
      ),
    ).toBeInTheDocument();
    expect(deleteUser).toHaveBeenCalledWith("u1", "Karim Belkacem");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    deleteUser.mockResolvedValueOnce(undefined);
    await user.click(confirm);
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
