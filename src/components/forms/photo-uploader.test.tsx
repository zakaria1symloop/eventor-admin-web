import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { PhotoUploader, type PhotoItem } from "./photo-uploader";

function makeItems(n: number): PhotoItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, url: "", status: "ready" as const }));
}

function Harness({
  initial,
  limit,
  onChange,
}: {
  initial: PhotoItem[];
  limit: number;
  onChange?: (items: PhotoItem[]) => void;
}) {
  const [items, setItems] = useState(initial);
  return (
    <PhotoUploader
      value={items}
      limit={limit}
      maxSizeMb={1}
      onChange={(next) => {
        setItems(next);
        onChange?.(next);
      }}
    />
  );
}

const file = (name: string, type = "image/jpeg", size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

describe("PhotoUploader", () => {
  it("shows the count against the limit and only accepts files up to the limit", () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial={makeItems(10)} limit={12} onChange={onChange} />);
    expect(screen.getByText("10 / 12")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("photo-input"), {
      target: { files: [file("a.jpg"), file("b.jpg"), file("c.jpg")] },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ status: "ready" })]),
    );
    expect(onChange.mock.lastCall?.[0]).toHaveLength(12);
    expect(screen.getByText("12 / 12")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("1 photo was not added: the limit is 12.");
    // Full: the add tile disappears.
    expect(screen.queryByRole("button", { name: "Add photos" })).not.toBeInTheDocument();
  });

  it("rejects wrong types and oversized files on the client", () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial={[]} limit={12} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("photo-input"), {
      target: {
        files: [
          file("doc.pdf", "application/pdf"),
          file("big.jpg", "image/jpeg", 2 * 1024 * 1024),
          file("ok.png", "image/png"),
        ],
      },
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("doc.pdf: only JPG, PNG or WebP");
    expect(alert).toHaveTextContent("big.jpg: larger than 1 MB");
    expect(onChange.mock.lastCall?.[0]).toHaveLength(1);
    expect(screen.getByText("Cover")).toBeInTheDocument();
  });

  it("reorders with the move buttons (first photo is the cover)", () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial={makeItems(3)} limit={12} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Move later" })[0]);
    expect(onChange.mock.lastCall?.[0].map((p: PhotoItem) => p.id)).toEqual(["p1", "p0", "p2"]);
  });
});
