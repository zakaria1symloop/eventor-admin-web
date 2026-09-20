import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api/errors";
import type { SettingItem } from "@/lib/api/settings";
import { SettingsSectionCard } from "./settings-sections";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const updateSettings = vi.fn();
vi.mock("@/lib/api/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/settings")>()),
  updateSettings: (...args: unknown[]) => updateSettings(...args),
}));

const items: SettingItem[] = [
  {
    key: "platform_fee_percent",
    value: 10,
    type: "decimal",
    min: 0,
    max: 50,
    sensitive: true,
    updatedAt: "2026-09-15T10:00:00.000Z",
    updatedBy: { id: "a1", fullName: "Sara Meziane" },
  },
];

describe("SET-01 sensitive save", () => {
  beforeEach(() => updateSettings.mockReset());

  it("shows the old → new diff and resends with confirm: true", async () => {
    const user = userEvent.setup();
    updateSettings
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: "SETTINGS_CONFIRM_REQUIRED",
          message: "Confirm",
          details: {
            diff: [{ key: "platform_fee_percent", old: 10, new: 12 }],
            sensitiveKeys: ["platform_fee_percent"],
          },
        }),
      )
      .mockResolvedValueOnce({ sections: [{ key: "commission", settings: [{ ...items[0], value: 12 }] }] });

    renderWithProviders(
      <SettingsSectionCard sectionKey="commission" items={items} onDirtyChange={() => undefined} />,
    );
    expect(screen.getByText(/Last changed .* by Sara Meziane/)).toBeInTheDocument();
    const input = screen.getByLabelText("Platform fee");
    await user.clear(input);
    await user.type(input, "12");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Confirm these changes")).toBeInTheDocument();
    expect(within(dialog).getByText("10 %")).toBeInTheDocument();
    expect(within(dialog).getByText("12 %")).toBeInTheDocument();
    expect(updateSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ values: { platform_fee_percent: 12 } }),
    );

    await user.type(within(dialog).getByRole("textbox"), "New fee from October");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateSettings).toHaveBeenLastCalledWith({
        values: { platform_fee_percent: 12 },
        expectedUpdatedAt: { platform_fee_percent: "2026-09-15T10:00:00.000Z" },
        confirm: true,
        note: "New fee from October",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the stale banner on STALE_UPDATE", async () => {
    const user = userEvent.setup();
    updateSettings.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "STALE_UPDATE",
        message: "Stale",
        details: { keys: ["platform_fee_percent"] },
      }),
    );
    renderWithProviders(
      <SettingsSectionCard sectionKey="commission" items={items} onDirtyChange={() => undefined} />,
    );
    const input = screen.getByLabelText("Platform fee");
    await user.clear(input);
    await user.type(input, "11");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("These settings were changed by someone else")).toBeInTheDocument();
  });
});
