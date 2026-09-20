import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardHref, flagSegments, maskContacts, type ReviewDetail } from "@/lib/api/reviews";
import { renderWithProviders } from "@/test/render";
import { ReviewDrawer } from "./review-drawer";

const getReview = vi.fn();
const moderateReview = vi.fn();
vi.mock("@/lib/api/reviews", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/reviews")>()),
  getReview: (...a: unknown[]) => getReview(...a),
  moderateReview: (...a: unknown[]) => moderateReview(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reviews",
}));

const review: ReviewDetail = {
  id: "r1",
  rating: 4,
  comment: "Nice hall. Call me on 0555 12 34 56 and I'll get you a better price.",
  redactedComment: null,
  status: "published",
  author: { id: "u1", fullName: "Rym Tahar" },
  provider: { id: "p1", fullName: "Farid Ouali", businessName: "Salle Yasmine" },
  service: { id: "s1", titleEn: "Grande salle · 150 seats", titleAr: "قاعة كبرى" },
  pack: null,
  booking: {
    id: "b1",
    reference: "EVT-001851",
    status: "completed",
    disputeStatus: "none",
    eventDate: "2026-02-14",
    total: "220000.00",
  } as ReviewDetail["booking"],
  hadDispute: false,
  detectedFlags: ["phone"],
  reportsOpen: 1,
  reply: null,
  createdAt: "2026-02-20T10:00:00.000Z",
  editedAt: null,
  disputes: [],
  reports: [
    {
      id: "rep1",
      targetType: "review",
      reason: "contact_outside",
      note: null,
      status: "open",
      reporter: { id: "p1", fullName: "Salle Yasmine" },
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      disputeId: null,
      createdAt: "2026-02-20T11:00:00.000Z",
    },
  ],
  moderatedBy: null,
  moderatedAt: null,
  moderationNote: null,
  allowedActions: ["hide", "redact", "dismiss_reports", "edit", "delete", "convert_report"],
  updatedAt: "2026-02-20T11:00:00.000Z",
};

describe("review flags", () => {
  it("highlights and masks contact details", () => {
    const text = "Call 0555 12 34 56 or mail me@salle.dz, see www.salle.dz";
    expect(
      flagSegments(text)
        .filter((s) => s.flag)
        .map((s) => s.flag),
    ).toEqual(["phone", "email", "link"]);
    expect(maskContacts(text, "[x]")).toBe("Call [x] or mail [x], see [x]");
    expect(maskContacts("Great team, thanks!", "[x]")).toBe("Great team, thanks!");
  });

  it("maps API routes to dashboard routes", () => {
    expect(dashboardHref("/reviews/abc")).toBe("/reviews?review=abc");
    expect(dashboardHref("/activity-log/l1")).toBe("/activity-log?entry=l1");
    expect(dashboardHref("/bookings/b1")).toBe("/bookings/b1");
  });
});

describe("ReviewDrawer (REV-02)", () => {
  beforeEach(() => {
    getReview.mockReset().mockResolvedValue(review);
    moderateReview.mockReset();
  });

  it("prefills the redacted text and requires it before hiding the phone number only", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    moderateReview.mockResolvedValue({ ...review, status: "redacted" });
    renderWithProviders(<ReviewDrawer id="r1" onClose={onClose} />);

    expect(await screen.findByRole("heading", { name: "Decision" })).toBeInTheDocument();
    expect(screen.getByText("Detected: phone number")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Hide the contact details only/ })).toBeChecked();
    const text = screen.getByRole("textbox", { name: /Text shown in the app/ });
    expect(text).toHaveValue("Nice hall. Call me on [contact removed] and I'll get you a better price.");

    await user.clear(text);
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("Write the text shown in the app.")).toBeInTheDocument();
    expect(moderateReview).not.toHaveBeenCalled();

    await user.type(text, "Nice hall.");
    await user.type(screen.getByRole("textbox", { name: /Note to the client/ }), "No phone numbers.");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(moderateReview).toHaveBeenCalledWith("r1", {
        action: "redact",
        redactedComment: "Nice hall.",
        note: "No phone numbers.",
        notifyAuthor: true,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the review and dismisses the reports without author notification", async () => {
    const user = userEvent.setup();
    moderateReview.mockResolvedValue({ ...review, reportsOpen: 0 });
    renderWithProviders(<ReviewDrawer id="r1" onClose={vi.fn()} />);
    await user.click(await screen.findByRole("radio", { name: /Keep as is/ }));
    expect(screen.queryByRole("textbox", { name: /Text shown in the app/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(moderateReview).toHaveBeenCalledWith("r1", {
        action: "dismiss_reports",
        redactedComment: undefined,
        note: undefined,
        notifyAuthor: undefined,
      }),
    );
  });
});
