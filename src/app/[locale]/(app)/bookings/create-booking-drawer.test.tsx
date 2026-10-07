import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CreateBookingDrawer } from "./create-booking-drawer";

const getUser = vi.fn();

vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  getUser: (...a: unknown[]) => getUser(...a),
  listUsers: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
}));
vi.mock("@/lib/api/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/settings")>()),
  getSettings: vi.fn().mockResolvedValue([]),
  flattenSettings: () => ({}),
}));
vi.mock("../services/use-service-options", () => ({
  useCatalog: () => ({ openWilayaOptions: [] }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bookings",
}));

const person = (role: "client" | "provider") => ({
  id: `${role}-1`,
  role,
  fullName: role === "client" ? "Amina Saidi" : "Karim Photo",
  email: `${role}@example.com`,
});

describe("CreateBookingDrawer", () => {
  beforeEach(() => getUser.mockReset());

  it("starts with the client from the profile already selected", async () => {
    getUser.mockResolvedValue(person("client"));

    renderWithProviders(<CreateBookingDrawer open clientId="client-1" onOpenChange={() => {}} />);

    expect(await screen.findByText("Amina Saidi")).toBeInTheDocument();
    expect(getUser).toHaveBeenCalledWith("client-1");
  });

  it("ignores an id that is not a client, and starts empty without one", async () => {
    getUser.mockResolvedValue(person("provider"));
    const { unmount } = renderWithProviders(
      <CreateBookingDrawer open clientId="provider-1" onOpenChange={() => {}} />,
    );
    await waitFor(() => expect(getUser).toHaveBeenCalledWith("provider-1"));
    expect(screen.queryByText("Karim Photo")).not.toBeInTheDocument();
    unmount();

    getUser.mockClear();
    renderWithProviders(<CreateBookingDrawer open onOpenChange={() => {}} />);
    expect(getUser).not.toHaveBeenCalled();
  });
});
