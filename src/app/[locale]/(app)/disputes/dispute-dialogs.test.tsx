import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { outcomeAllowed, outcomeResult, type DisputeDetail } from "@/lib/api/disputes";
import { renderWithProviders } from "@/test/render";
import { ResolveDisputeDialog } from "./dispute-dialogs";

const resolveDispute = vi.fn();
vi.mock("@/lib/api/disputes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/disputes")>()),
  resolveDispute: (...a: unknown[]) => resolveDispute(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/disputes",
}));

function dispute(bookingStatus: DisputeDetail["booking"]["status"]): DisputeDetail {
  return {
    id: "d1",
    reference: "DSP-000031",
    type: "provider_no_show",
    status: "in_review",
    booking: { id: "b1", reference: "EVT-002038", status: bookingStatus } as DisputeDetail["booking"],
  } as DisputeDetail;
}

describe("resolve rules (DSP-03)", () => {
  it("mirrors the API outcome rules", () => {
    expect(outcomeAllowed("completed", "cancelled")).toBe(false);
    expect(outcomeAllowed("completed", "accepted")).toBe(true);
    expect(outcomeAllowed("cancelled", "completed")).toBe(true);
    expect(outcomeAllowed("unchanged", "cancelled")).toBe(true);
    expect(outcomeResult("cancelled", "accepted")).toBe("cancelled");
    expect(outcomeResult("completed", "completed")).toBeNull();
  });
});

describe("ResolveDisputeDialog", () => {
  beforeEach(() => resolveDispute.mockReset());

  it("disables impossible outcomes and needs an outcome and a decision note", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    resolveDispute.mockResolvedValue({ ...dispute("cancelled"), status: "resolved" });
    renderWithProviders(
      <ResolveDisputeDialog
        disputeId="d1"
        dispute={dispute("cancelled")}
        open
        onOpenChange={vi.fn()}
        onDone={onDone}
      />,
    );
    expect(screen.getByRole("radio", { name: /Mark as completed/ })).toBeDisabled();
    expect(screen.getByText(/Payment is cash/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resolve dispute" }));
    expect(screen.getAllByText("Pick what happens to the booking.").length).toBeGreaterThan(0);
    expect(resolveDispute).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: /Leave unchanged/ }));
    await user.click(screen.getByRole("button", { name: "Resolve dispute" }));
    expect(screen.getAllByText("Write the decision note.").length).toBeGreaterThan(0);
    expect(resolveDispute).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Decision note/), "Both agreed, no change.");
    await user.click(screen.getByRole("button", { name: "Resolve dispute" }));
    await waitFor(() =>
      expect(resolveDispute).toHaveBeenCalledWith("d1", {
        bookingOutcome: "unchanged",
        decisionNote: "Both agreed, no change.",
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
