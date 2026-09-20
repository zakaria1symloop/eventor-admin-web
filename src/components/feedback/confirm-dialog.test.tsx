import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

function Harness(props: Partial<ConfirmDialogProps> & Pick<ConfirmDialogProps, "onConfirm">) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="open-state">{open ? "open" : "closed"}</span>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Block Karim Belkacem?"
        tone="danger"
        confirmLabel="Block account"
        {...props}
      />
    </>
  );
}

const reasonField = {
  required: true,
  options: [
    { value: "no_shows", label: "Repeated no-shows" },
    { value: "fraud", label: "Fraud" },
  ],
};

describe("ConfirmDialog", () => {
  it("requires a reason before confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<Harness onConfirm={onConfirm} reasonField={reasonField} />);

    await user.click(screen.getByRole("button", { name: "Block account" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByText("Pick a reason")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /Reason/ }), "fraud");
    await user.click(screen.getByRole("button", { name: "Block account" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason: "fraud" })));
    await waitFor(() => expect(screen.getByTestId("open-state")).toHaveTextContent("closed"));
  });

  it("keeps confirm disabled until the typeToConfirm value matches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<Harness onConfirm={onConfirm} typeToConfirm="Karim Belkacem" />);

    const confirm = screen.getByRole("button", { name: "Block account" });
    expect(confirm).toBeDisabled();
    const input = screen.getByLabelText("Type Karim Belkacem to confirm");
    await user.type(input, "Karim");
    expect(confirm).toBeDisabled();
    await user.type(input, " Belkacem");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("stays open, keeps the entered data and shows the API error when confirm fails", async () => {
    const user = userEvent.setup();
    let reject: (e: unknown) => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((_, r) => {
          reject = r;
        }),
    );
    renderWithProviders(
      <Harness
        onConfirm={onConfirm}
        reasonField={reasonField}
        messageField={{ label: "Message to the user" }}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: /Reason/ }), "no_shows");
    await user.type(screen.getByRole("textbox", { name: "Message to the user" }), "Contact support.");
    await user.click(screen.getByRole("button", { name: "Block account" }));

    // loading state
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Block account" })).toHaveAttribute("aria-busy", "true"),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    reject(
      new ApiError({
        status: 409,
        code: "USER_HAS_OPEN_DISPUTE",
        message: "This user has an open dispute.",
        requestId: "req_1",
      }),
    );

    expect(await screen.findByText("This user has an open dispute.")).toBeInTheDocument();
    expect(screen.getByTestId("open-state")).toHaveTextContent("open");
    expect(screen.getByRole("combobox", { name: /Reason/ })).toHaveValue("no_shows");
    expect(screen.getByRole("textbox", { name: "Message to the user" })).toHaveValue("Contact support.");
    expect(screen.getByRole("button", { name: "Block account" })).toBeEnabled();
  });
});
