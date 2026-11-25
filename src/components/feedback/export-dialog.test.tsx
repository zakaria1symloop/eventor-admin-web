import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ExportDialog } from "./export-dialog";

const base = {
  open: true,
  onOpenChange: () => undefined,
  resource: "users",
  title: "Export users",
  filters: {},
  columns: [{ key: "name", label: "Name" }],
};

describe("L-37 export dialog summary", () => {
  it("lists the search and the active filters under the summary", () => {
    renderWithProviders(
      <ExportDialog
        {...base}
        summary="12 users · Tab All"
        search="amina"
        activeFilters={[
          { label: "Wilaya", text: "Alger, Oran" },
          { label: "Status", text: "Blocked" },
        ]}
      />,
    );
    expect(screen.getByText("12 users · Tab All")).toBeInTheDocument();
    expect(screen.getByText("Search “amina” · Wilaya: Alger, Oran · Status: Blocked")).toBeInTheDocument();
  });

  it("says there is no filter when none is active", () => {
    renderWithProviders(<ExportDialog {...base} summary="45 users · Tab All" activeFilters={[]} search="" />);
    expect(screen.getByText("No filter: every row of this tab")).toBeInTheDocument();
  });
});
