import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { DeleteServiceDialog } from "./service-dialogs";

const deleteService = vi.fn();
vi.mock("@/lib/api/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/services")>()),
  deleteService: (...args: unknown[]) => deleteService(...args),
}));

const service = { id: "s1", title: "Wedding photo & video coverage", providerName: "Studio Lumière" };

beforeEach(() => deleteService.mockReset());

describe("SRV-06 DeleteServiceDialog", () => {
  it("shows the impact, then requires an explicit override after SERVICE_HAS_BOOKINGS and retries with force", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();
    deleteService
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: "SERVICE_HAS_BOOKINGS",
          message: "Has bookings",
          details: { upcomingBookings: 3 },
        }),
      )
      .mockResolvedValueOnce({
        id: "s1",
        cancelledBookings: 2,
        keptUpcomingBookings: 3,
        packsNeedingAttention: 1,
      });

    renderWithProviders(
      <DeleteServiceDialog
        service={service}
        open
        onOpenChange={onOpenChange}
        impact={{ pendingBookings: 2, upcomingBookings: 3, packs: ["Fiançailles"], reviews: 21 }}
        onHideInstead={() => undefined}
        onDeleted={onDeleted}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("2 pending bookings will be cancelled");
    expect(dialog).toHaveTextContent("Removed from the Ready Pack “Fiançailles”");
    expect(within(dialog).getByRole("button", { name: "Hide instead" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete service" }));
    expect(deleteService).toHaveBeenLastCalledWith("s1", false);
    await screen.findByText(/has 3 accepted upcoming bookings/);
    expect(onDeleted).not.toHaveBeenCalled();

    // Confirm again without ticking the override: refused locally, no request.
    await user.click(within(dialog).getByRole("button", { name: "Delete anyway" }));
    await screen.findByText(/tick the override/);
    expect(deleteService).toHaveBeenCalledTimes(1);

    await user.click(
      within(dialog).getByRole("checkbox", { name: /Delete anyway and keep the 3 accepted bookings/ }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete anyway" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteService).toHaveBeenLastCalledWith("s1", true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("deletes directly when nothing blocks it", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    deleteService.mockResolvedValue({
      id: "s1",
      cancelledBookings: 0,
      keptUpcomingBookings: 0,
      packsNeedingAttention: 0,
    });
    renderWithProviders(
      <DeleteServiceDialog service={service} open onOpenChange={() => undefined} onDeleted={onDeleted} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete service" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteService).toHaveBeenCalledWith("s1", false);
  });
});
