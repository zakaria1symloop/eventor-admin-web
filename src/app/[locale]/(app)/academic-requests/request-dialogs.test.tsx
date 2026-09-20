import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeableFields, type RequestDetail } from "@/lib/api/academic-requests";
import { renderWithProviders } from "@/test/render";
import { RequestChangesDialog } from "./request-dialogs";

const requestChanges = vi.fn();
vi.mock("@/lib/api/academic-requests", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/academic-requests")>()),
  requestChanges: (...a: unknown[]) => requestChanges(...a),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/academic-requests",
}));

const answer = (key: string, type: string, labelEn: string) => ({
  key,
  type,
  labelEn,
  labelAr: `${labelEn} (ar)`,
  section: null,
  value: null,
  displayValue: null,
  changed: false,
});

const request = {
  id: "r1",
  reference: "ACR-000142",
  status: "pending",
  answers: [
    answer("event_date", "date", "Event date"),
    answer("intro", "info", "Read this first"),
    answer("attendees", "number", "Expected attendees"),
    answer("programme", "file", "Programme"),
  ],
} as unknown as RequestDetail;

describe("request-changes field list (ACR-04)", () => {
  beforeEach(() => requestChanges.mockReset());

  it("lists the input fields of the form version only", () => {
    expect(changeableFields(request.answers).map((a) => a.key)).toEqual([
      "event_date",
      "attendees",
      "programme",
    ]);
  });

  it("needs at least one field and a message, then sends the keys", async () => {
    const user = userEvent.setup();
    requestChanges.mockResolvedValue({ ...request, status: "changes_requested" });
    renderWithProviders(<RequestChangesDialog request={request} open onOpenChange={vi.fn()} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.queryByText("Read this first")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Message/), "Please confirm the date.");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getAllByText("Pick at least one field.").length).toBeGreaterThan(0);
    expect(requestChanges).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: "Event date" }));
    await user.click(screen.getByRole("checkbox", { name: "Programme" }));
    await user.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() =>
      expect(requestChanges).toHaveBeenCalledWith("r1", {
        fields: ["event_date", "programme"],
        message: "Please confirm the date.",
      }),
    );
  });
});
