import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMessage } from "@/lib/api/messaging";
import { renderWithProviders } from "@/test/render";
import { ModeratedMessage } from "./inbox-thread";

const moderateMessage = vi.fn();
vi.mock("@/lib/api/messaging", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/messaging")>()),
  moderateMessage: (...a: unknown[]) => moderateMessage(...a),
}));

const message: AdminMessage = {
  id: "m1",
  conversationId: "c1",
  kind: "text",
  sender: { id: "u1", fullName: "Rym Tahar", role: "client", avatarUrl: null },
  senderLabel: "Rym Tahar",
  body: "Call me on 0555 12 34 56",
  bodyMasked: "Call me on [phone hidden]",
  masked: true,
  detectedContacts: ["phone"],
  status: "visible",
  moderation: null,
  reportsOpen: 1,
  fileId: null,
  createdAt: "2026-09-14T09:15:00Z",
};

beforeEach(() => moderateMessage.mockReset());

describe("MSG-01 ModeratedMessage", () => {
  it("shows the original text with a masked-for-users indicator that reveals the masked version", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeratedMessage message={message} side="start" onChange={() => undefined} />);
    expect(screen.getByText("Call me on 0555 12 34 56")).toBeInTheDocument();
    expect(screen.getByText("Flagged")).toBeInTheDocument();
    const indicator = screen.getByRole("button", { name: /Contact details masked for users/ });
    await user.click(indicator);
    expect(screen.getByText("Call me on [phone hidden]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show original/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("hides immediately (optimistic) and applies the API result", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    moderateMessage.mockResolvedValue({ ...message, status: "hidden" });
    renderWithProviders(<ModeratedMessage message={message} side="start" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(onChange).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "m1", status: "hidden" }));
    await waitFor(() => expect(moderateMessage).toHaveBeenCalledWith("m1", "hide"));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  });

  it("rolls back when hiding fails and asks before deleting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    moderateMessage.mockRejectedValueOnce(new Error("nope"));
    renderWithProviders(<ModeratedMessage message={message} side="start" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(message));

    moderateMessage.mockResolvedValueOnce({ ...message, status: "deleted" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete this message?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete message" }));
    await waitFor(() => expect(moderateMessage).toHaveBeenLastCalledWith("m1", "delete"));
  });
});
