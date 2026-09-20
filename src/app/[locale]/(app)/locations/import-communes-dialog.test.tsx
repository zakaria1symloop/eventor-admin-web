import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ImportCommunesDialog, ImportResultSummary } from "./import-communes-dialog";

const importCommunes = vi.fn();
vi.mock("@/lib/api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/catalog")>()),
  importCommunes: (...args: unknown[]) => importCommunes(...args),
}));

describe("LOC-02 communes import", () => {
  it("renders counts and per-line errors", () => {
    renderWithProviders(
      <ImportResultSummary
        result={{
          created: 40,
          updated: 3,
          skipped: 14,
          errors: [
            { line: 4, message: "postal_code must have 5 digits" },
            { line: 9, message: "Unknown wilaya_code 77" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Import finished with 2 errors")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("4")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Unknown wilaya_code 77")).toBeInTheDocument();
  });

  it("uploads the file and shows the result", async () => {
    const user = userEvent.setup();
    importCommunes.mockResolvedValueOnce({ created: 2, updated: 0, skipped: 0, errors: [] });
    const onImported = vi.fn();
    renderWithProviders(<ImportCommunesDialog open onOpenChange={() => undefined} onImported={onImported} />);
    const file = new File(["wilaya_code,name,name_ar\n16,Hydra,Hydra\n"], "communes.csv", {
      type: "text/csv",
    });
    await user.upload(screen.getByLabelText(/Choose a CSV file/), file);
    await user.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(importCommunes).toHaveBeenCalledWith(file));
    expect(await screen.findByText("Import finished")).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
  });
});
