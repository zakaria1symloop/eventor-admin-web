import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { RejectDocumentDialog } from "./reject-dialog";
import { useReviewShortcuts, type ReviewShortcuts } from "./use-review-shortcuts";

function Harness(props: ReviewShortcuts) {
  useReviewShortcuts(props);
  return (
    <div>
      <input aria-label="search" />
    </div>
  );
}

describe("VER-02 keyboard shortcuts", () => {
  it("maps A / R / J / K and ignores typing, modifiers and open dialogs", () => {
    const h = { onApprove: vi.fn(), onReject: vi.fn(), onNext: vi.fn(), onPrev: vi.fn() };
    const { rerender } = render(<Harness {...h} />);

    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "R" });
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "k" });
    expect(h.onApprove).toHaveBeenCalledTimes(1);
    expect(h.onReject).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
    expect(h.onPrev).toHaveBeenCalledTimes(1);

    // Typing in a field.
    fireEvent.keyDown(screen.getByLabelText("search"), { key: "a" });
    // Modifier (Ctrl+A selects all).
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(h.onApprove).toHaveBeenCalledTimes(1);

    // An open dialog swallows shortcuts.
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: "j" });
    expect(h.onNext).toHaveBeenCalledTimes(1);
    dialog.remove();

    // Disabled.
    rerender(<Harness {...h} enabled={false} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(h.onPrev).toHaveBeenCalledTimes(1);
  });
});

describe("VER-03 RejectDocumentDialog", () => {
  it("prefills the message from the reason chip and sends reasonCode + message", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RejectDocumentDialog
        open
        onOpenChange={onOpenChange}
        documentLabel="Tax card (NIF)"
        userName="Fatima Hadj"
        businessName="Fleurs de Yasmina"
        onReject={onReject}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Reject Tax card (NIF)?" });
    expect(
      within(dialog).getByText("Fatima gets a notification in the app and can send a new file."),
    ).toBeInTheDocument();

    // Reason required.
    await user.click(within(dialog).getByRole("button", { name: "Reject document" }));
    expect(await within(dialog).findByText("Pick a reason")).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();

    const message = within(dialog).getByRole("textbox");
    await user.click(within(dialog).getByRole("radio", { name: "Name doesn't match the account" }));
    expect(message).toHaveValue(
      "The name on your Tax card (NIF) is different from your account (Fleurs de Yasmina). Please send the document for Fleurs de Yasmina or update your account details.",
    );

    // Switching reason replaces an untouched prefill.
    await user.click(within(dialog).getByRole("radio", { name: "Expired" }));
    expect(message).toHaveValue(
      "Your Tax card (NIF) has expired. Please send a document that is still valid.",
    );

    // An edited message is kept when switching again.
    await user.type(message, " Thanks.");
    await user.click(within(dialog).getByRole("radio", { name: "Unreadable or blurry" }));
    expect(message).toHaveValue(
      "Your Tax card (NIF) has expired. Please send a document that is still valid. Thanks.",
    );

    await user.click(within(dialog).getByRole("button", { name: "Reject document" }));
    await waitFor(() =>
      expect(onReject).toHaveBeenCalledWith({
        reasonCode: "unreadable",
        message: "Your Tax card (NIF) has expired. Please send a document that is still valid. Thanks.",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires a message for “Other”", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    renderWithProviders(
      <RejectDocumentDialog
        open
        onOpenChange={() => undefined}
        documentLabel="National ID card"
        userName="Walid Saadi"
        onReject={onReject}
      />,
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Other" }));
    expect(within(dialog).getByRole("textbox")).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Reject document" }));
    expect(await within(dialog).findByText("Write the message the provider will see")).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
  });
});
