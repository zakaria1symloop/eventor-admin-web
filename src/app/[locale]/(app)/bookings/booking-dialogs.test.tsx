import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail } from "@/lib/api/bookings";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { PriceDrawer, RescheduleDialog, StatusDialog } from "./booking-dialogs";

const changeBookingStatus = vi.fn();
const changeBookingPrice = vi.fn();
const rescheduleBooking = vi.fn();
const getAvailability = vi.fn();

vi.mock("@/lib/api/bookings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/bookings")>()),
  changeBookingStatus: (...a: unknown[]) => changeBookingStatus(...a),
  changeBookingPrice: (...a: unknown[]) => changeBookingPrice(...a),
  rescheduleBooking: (...a: unknown[]) => rescheduleBooking(...a),
}));
vi.mock("@/lib/api/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/services")>()),
  getAvailability: (...a: unknown[]) => getAvailability(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bookings",
}));

const target = {
  id: "b1",
  reference: "EVT-002030",
  clientName: "Sofiane Brahimi",
  status: "pending" as const,
};

function booking(over: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: "b1",
    reference: "EVT-002030",
    service: { id: "s1", titleEn: "Wedding photo", titleAr: "تصوير" },
    pack: null,
    client: {
      id: "c1",
      fullName: "Sofiane Brahimi",
      avatarUrl: null,
      email: "s@x.dz",
      phone: null,
      bookingsCount: 7,
      status: "active",
    },
    provider: {
      id: "p1",
      fullName: "Karim Belkacem",
      businessName: "Studio Lumière",
      avatarUrl: null,
      email: "k@x.dz",
      phone: null,
      rating: 4.8,
      ratingCount: 10,
      avgReplyMinutes: 80,
      replyRate: 90,
      completedBookingsCount: 3,
      acceptingBookings: true,
      status: "active",
    },
    eventDate: "2030-04-02",
    endDate: null,
    startTime: "14:00",
    endTime: "23:00",
    eventType: "wedding",
    wilaya: { code: 16, name: "Alger", nameAr: "الجزائر" },
    guests: 180,
    total: "55000.00",
    status: "pending",
    disputeStatus: "none",
    noReply: false,
    respondedAt: null,
    createdAt: "2030-03-12T18:40:00Z",
    source: "android",
    offer: {
      kind: "service",
      id: "s1",
      titleEn: "Wedding photo",
      titleAr: "تصوير",
      coverUrl: null,
      priceType: "per_event",
      basePrice: "45000.00",
      cancellationPolicyEn: null,
      cancellationPolicyAr: null,
    },
    locationText: null,
    commune: null,
    clientNote: null,
    lines: [
      {
        id: "l1",
        kind: "service",
        label: "Service price",
        quantity: 1,
        unitAmount: "45000.00",
        amount: "45000.00",
        serviceId: "s1",
        position: 0,
      },
      {
        id: "l2",
        kind: "extra",
        label: "Henna evening",
        quantity: 1,
        unitAmount: "12000.00",
        amount: "12000.00",
        serviceId: null,
        position: 1,
      },
      {
        id: "l3",
        kind: "discount",
        label: "Discount",
        quantity: 1,
        unitAmount: "2000.00",
        amount: "-2000.00",
        serviceId: null,
        position: 2,
      },
    ],
    subtotal: "57000.00",
    discountTotal: "2000.00",
    feePercent: "10.00",
    feeAmount: "5500.00",
    providerAmount: "49500.00",
    declineReason: null,
    cancelledBy: null,
    cancelReason: null,
    reminderSentAt: null,
    completedAt: null,
    reviewRequestedAt: null,
    replyDeadlineAt: null,
    createdBy: null,
    academicRequest: null,
    timeline: [],
    pendingReschedule: null,
    invoice: null,
    conversation: null,
    dispute: null,
    allowedTransitions: [],
    history: [],
    updatedAt: "2030-03-12T18:40:00Z",
    ...over,
  };
}

beforeEach(() => {
  changeBookingStatus.mockReset().mockResolvedValue(booking());
  changeBookingPrice.mockReset();
  rescheduleBooking.mockReset();
  getAvailability.mockReset();
});

describe("BKG-04 StatusDialog", () => {
  it("accept: reason optional, note required", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithProviders(
      <StatusDialog bookings={[target]} action="accepted" onOpenChange={() => undefined} onDone={onDone} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Accept booking #EVT-002030?" });
    await user.click(within(dialog).getByRole("button", { name: "Accept booking" }));
    expect(await within(dialog).findByText("Required")).toBeInTheDocument();
    expect(within(dialog).queryByText("Pick a reason")).not.toBeInTheDocument();
    expect(changeBookingStatus).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole("textbox"), "Called the provider");
    await user.click(within(dialog).getByRole("button", { name: "Accept booking" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(changeBookingStatus).toHaveBeenCalledWith("b1", {
      status: "accepted",
      reason: undefined,
      note: "Called the provider",
      notify: true,
    });
  });

  it("decline: reason and note required; footer shows the move", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StatusDialog
        bookings={[target]}
        action="declined"
        onOpenChange={() => undefined}
        onDone={() => undefined}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Decline booking #EVT-002030?" });
    expect(dialog).toHaveTextContent("Pending → Declined");
    await user.click(within(dialog).getByRole("button", { name: "Decline booking" }));
    expect(await within(dialog).findByText("Pick a reason")).toBeInTheDocument();
    expect(within(dialog).getByText("Required")).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox"), "provider_unavailable");
    await user.type(within(dialog).getByRole("textbox"), "Fully booked");
    await user.click(within(dialog).getByRole("checkbox", { name: /Notify/ }));
    await user.click(within(dialog).getByRole("button", { name: "Decline booking" }));
    await waitFor(() =>
      expect(changeBookingStatus).toHaveBeenCalledWith("b1", {
        status: "declined",
        reason: "provider_unavailable",
        note: "Fully booked",
        notify: false,
      }),
    );
  });

  it("cancel: sends who cancelled and shows API errors in the dialog", async () => {
    const user = userEvent.setup();
    changeBookingStatus.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "BOOKING_INVALID_TRANSITION",
        message: "This status change is not allowed",
      }),
    );
    renderWithProviders(
      <StatusDialog
        bookings={[{ ...target, status: "accepted" }]}
        action="cancelled"
        onOpenChange={() => undefined}
        onDone={() => undefined}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Cancel booking #EVT-002030?" });
    const [cancelledBy, reason] = within(dialog).getAllByRole("combobox");
    await user.selectOptions(cancelledBy, "client");
    await user.selectOptions(reason, "client_request");
    await user.type(within(dialog).getByRole("textbox"), "Client called");
    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));
    expect(await within(dialog).findByText("This status change is not allowed")).toBeInTheDocument();
    expect(changeBookingStatus).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ cancelledBy: "client" }),
    );
  });
});

describe("BKG-06 PriceDrawer", () => {
  it("recomputes totals live and sends unit amounts", async () => {
    const user = userEvent.setup();
    changeBookingPrice.mockResolvedValue(booking({ total: "50000.00" }));
    const onDone = vi.fn();
    renderWithProviders(
      <PriceDrawer booking={booking()} open onOpenChange={() => undefined} onDone={onDone} />,
    );
    const totals = screen.getByTestId("price-totals");
    expect(totals).toHaveTextContent("Before55 000 DA");
    expect(totals).toHaveTextContent("New total for client55 000 DA");
    expect(totals).toHaveTextContent("Platform fee · 10%5 500 DA");

    const discount = screen.getByRole("textbox", { name: "Line 3 amount" });
    await user.clear(discount);
    await user.type(discount, "7000");
    expect(totals).toHaveTextContent("New total for client50 000 DA");
    expect(totals).toHaveTextContent("Provider receives45 000 DA");

    await user.type(screen.getByRole("textbox", { name: /Reason/ }), "Loyalty discount");
    await user.click(screen.getByRole("button", { name: "Save price" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(changeBookingPrice).toHaveBeenCalledWith("b1", {
      reason: "Loyalty discount",
      lines: [
        { kind: "service", label: "Service price", quantity: 1, unitAmount: "45000.00", serviceId: "s1" },
        { kind: "extra", label: "Henna evening", quantity: 1, unitAmount: "12000.00" },
        { kind: "discount", label: "Discount", quantity: 1, unitAmount: "7000.00" },
      ],
    });
  });
});

describe("BKG-05 RescheduleDialog", () => {
  it("asks for “Book anyway” on a busy day and sends force", async () => {
    const user = userEvent.setup();
    getAvailability.mockResolvedValue({
      providerId: "p1",
      month: "2030-04",
      maxEventsPerDay: 1,
      days: [{ date: "2030-04-09", status: "booked", items: [] }],
    });
    rescheduleBooking.mockResolvedValue(booking({ eventDate: "2030-04-09" }));
    const onDone = vi.fn();
    renderWithProviders(
      <RescheduleDialog booking={booking()} open onOpenChange={() => undefined} onDone={onDone} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Reschedule #EVT-002030" });
    await user.click(await within(dialog).findByRole("gridcell", { name: /^2030-04-09 · Booked/ }));
    expect(within(dialog).getByText(/already booked or blocked/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /Reason/ }), "client_request");
    await user.click(within(dialog).getByRole("button", { name: "Change date" }));
    expect(await within(dialog).findByText(/Tick “Book anyway”/)).toBeInTheDocument();
    expect(rescheduleBooking).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("checkbox", { name: /Book anyway/ }));
    await user.click(within(dialog).getByRole("button", { name: "Change date" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(rescheduleBooking).toHaveBeenCalledWith("b1", {
      date: "2030-04-09",
      startTime: "14:00",
      endTime: "23:00",
      reason: "client_request",
      force: true,
    });
  });

  it("offers the override when the API answers DATE_UNAVAILABLE on a free-looking day", async () => {
    const user = userEvent.setup();
    getAvailability.mockResolvedValue({ providerId: "p1", month: "2030-04", maxEventsPerDay: 1, days: [] });
    rescheduleBooking
      .mockRejectedValueOnce(new ApiError({ status: 409, code: "DATE_UNAVAILABLE", message: "Busy" }))
      .mockResolvedValueOnce(booking());
    renderWithProviders(
      <RescheduleDialog booking={booking()} open onOpenChange={() => undefined} onDone={() => undefined} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Reschedule #EVT-002030" });
    await user.click(await within(dialog).findByRole("gridcell", { name: /^2030-04-10 · Free/ }));
    await user.selectOptions(within(dialog).getByRole("combobox", { name: /Reason/ }), "weather");
    await user.click(within(dialog).getByRole("button", { name: "Change date" }));
    expect(
      await within(dialog).findByText("The provider is not available on this date."),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: /Book anyway/ }));
    await user.click(within(dialog).getByRole("button", { name: "Change date" }));
    await waitFor(() =>
      expect(rescheduleBooking).toHaveBeenLastCalledWith("b1", expect.objectContaining({ force: true })),
    );
  });
});
