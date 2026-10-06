import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { AvatarField } from "./avatar-field";

describe("AvatarField", () => {
  it("shows initials without a photo, and uploads the chosen file", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AvatarField name="Sara Meziane" src={null} onUpload={onUpload} onRemove={vi.fn()} />);

    expect(screen.getByText("SM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();

    const file = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("avatar-file"), { target: { files: [file] } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it("offers Remove when there is a photo", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AvatarField name="Sara" src="https://cdn/x.webp" onUpload={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
  });
});
