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
const getSettings = vi.fn();
vi.mock("@/lib/api/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/settings")>()),
  updateSettings: (...args: unknown[]) => updateSettings(...args),
  getSettings: (...args: unknown[]) => getSettings(...args),
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
    expect(
      await screen.findByText("These settings were changed by someone else meanwhile"),
    ).toBeInTheDocument();
  });
});

/* L-07 — two tabs editing the same section (conflict rule (a): same setting only). */
const T0 = "2026-11-20T08:00:00.000Z";
const T1 = "2026-11-25T09:00:00.000Z";
const bookingItems: SettingItem[] = [
  {
    key: "booking_min_notice_days",
    value: 1,
    type: "integer",
    min: 0,
    max: 30,
    sensitive: false,
    updatedAt: T0,
    updatedBy: null,
  },
  {
    key: "review_edit_hours",
    value: 48,
    type: "integer",
    min: 0,
    max: 168,
    sensitive: false,
    updatedAt: T0,
    updatedBy: null,
  },
];
/** What tab 1 saved meanwhile: minimum notice 1 → 3. */
const afterTab1: SettingItem[] = [
  { ...bookingItems[0], value: 3, updatedAt: T1, updatedBy: { id: "a2", fullName: "Sara Meziane" } },
  bookingItems[1],
];
const staleError = () =>
  new ApiError({
    status: 409,
    code: "STALE_UPDATE",
    message: "Stale",
    details: { keys: ["booking_min_notice_days"] },
  });

async function typeInto(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

describe("L-07 settings changed in two tabs", () => {
  beforeEach(() => {
    updateSettings.mockReset();
    getSettings.mockReset();
  });

  it("sends only the changed keys, each with the updatedAt it was loaded with", async () => {
    const user = userEvent.setup();
    updateSettings.mockResolvedValueOnce({ sections: [{ key: "bookings", settings: bookingItems }] });
    renderWithProviders(
      <SettingsSectionCard sectionKey="bookings" items={bookingItems} onDirtyChange={() => undefined} />,
    );
    await typeInto(user, "Review edit time", "24");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateSettings).toHaveBeenLastCalledWith({
        values: { review_edit_hours: 24 },
        expectedUpdatedAt: { review_edit_hours: T0 },
      }),
    );
  });

  it("keeps unsaved input and its loaded updatedAt when the data refreshes underneath", async () => {
    const user = userEvent.setup();
    updateSettings.mockRejectedValueOnce(staleError());
    const { rerender } = renderWithProviders(
      <SettingsSectionCard sectionKey="bookings" items={bookingItems} onDirtyChange={() => undefined} />,
    );
    await typeInto(user, "Minimum notice", "5");
    // e.g. another card of this page saved and refreshed every section
    rerender(<SettingsSectionCard sectionKey="bookings" items={afterTab1} onDirtyChange={() => undefined} />);
    expect(screen.getByLabelText("Minimum notice")).toHaveValue("5");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    // still checked against what the admin edited (T0), so the change made meanwhile is not overwritten
    await waitFor(() =>
      expect(updateSettings).toHaveBeenLastCalledWith({
        values: { booking_min_notice_days: 5 },
        expectedUpdatedAt: { booking_min_notice_days: T0 },
      }),
    );
    expect(
      await screen.findByText("These settings were changed by someone else meanwhile"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum notice")).toHaveValue("5");
  });

  it("Reload loads the latest values, keeps the input, and saving re-applies it", async () => {
    const user = userEvent.setup();
    updateSettings.mockRejectedValueOnce(staleError()).mockResolvedValueOnce({
      sections: [
        {
          key: "bookings",
          settings: [{ ...afterTab1[0], value: 5, updatedAt: "2026-11-25T09:05:00.000Z" }, afterTab1[1]],
        },
      ],
    });
    getSettings.mockResolvedValueOnce({ sections: [{ key: "bookings", settings: afterTab1 }] });
    const { rerender } = renderWithProviders(
      <SettingsSectionCard sectionKey="bookings" items={bookingItems} onDirtyChange={() => undefined} />,
    );
    await typeInto(user, "Minimum notice", "5");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(await screen.findByRole("button", { name: "Reload" }));
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    // the settings screen passes the refetched items down
    rerender(<SettingsSectionCard sectionKey="bookings" items={afterTab1} onDirtyChange={() => undefined} />);

    expect(await screen.findByText("Latest values loaded: changed meanwhile")).toBeInTheDocument();
    expect(screen.getByText("Minimum notice is now 3 days (changed by Sara Meziane)")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum notice")).toHaveValue("5");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateSettings).toHaveBeenLastCalledWith({
        values: { booking_min_notice_days: 5 },
        expectedUpdatedAt: { booking_min_notice_days: T1 },
      }),
    );
  });

  it("Discard my changes goes back to the latest values", async () => {
    const user = userEvent.setup();
    updateSettings.mockRejectedValueOnce(staleError());
    getSettings.mockResolvedValueOnce({ sections: [{ key: "bookings", settings: afterTab1 }] });
    const { rerender } = renderWithProviders(
      <SettingsSectionCard sectionKey="bookings" items={bookingItems} onDirtyChange={() => undefined} />,
    );
    await typeInto(user, "Minimum notice", "5");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(await screen.findByRole("button", { name: "Reload" }));
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    rerender(<SettingsSectionCard sectionKey="bookings" items={afterTab1} onDirtyChange={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Discard my changes" }));
    expect(screen.getByLabelText("Minimum notice")).toHaveValue("3");
    expect(screen.queryByText("Latest values loaded: changed meanwhile")).not.toBeInTheDocument();
  });
});

describe("BUG-F1 request expiry setting", () => {
  const expire: SettingItem = {
    key: "booking_auto_expire",
    value: false,
    type: "boolean",
    min: null,
    max: null,
    sensitive: true,
    updatedAt: T0,
    updatedBy: null,
  };

  it("shows booking_auto_expire as a labelled toggle with its explanation, in EN and AR", () => {
    const { unmount } = renderWithProviders(
      <SettingsSectionCard sectionKey="bookings" items={[expire]} onDirtyChange={() => undefined} />,
    );
    expect(
      screen.getByRole("switch", { name: "Decline unanswered requests automatically" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A pending request is declined once the provider's reply deadline passes/),
    ).toBeInTheDocument();
    expect(screen.queryByText("booking_auto_expire")).not.toBeInTheDocument();
    unmount();
    renderWithProviders(
      <SettingsSectionCard sectionKey="bookings" items={[expire]} onDirtyChange={() => undefined} />,
      { locale: "ar" },
    );
    expect(
      screen.getByRole("switch", { name: "رفض الطلبات التي لم يُرد عليها تلقائيًا" }),
    ).toBeInTheDocument();
  });
});

describe("L-08 readable validation errors", () => {
  const upload: SettingItem = {
    key: "max_photo_upload_mb",
    value: 10,
    type: "integer",
    min: 1,
    max: 20,
    sensitive: false,
    updatedAt: T0,
    updatedBy: null,
  };
  const version: SettingItem = {
    key: "min_app_version",
    value: "1.0.0",
    type: "version",
    min: null,
    max: null,
    maxLength: 20,
    sensitive: false,
    updatedAt: T0,
    updatedBy: null,
  };
  const invalid = (details: { field: string; code: string; message: string }[]) =>
    new ApiError({ status: 400, code: "VALIDATION_FAILED", message: "Some fields are invalid.", details });

  beforeEach(() => {
    updateSettings.mockReset();
  });

  it("maps MAX / MIN / IS_NOT_EMPTY to messages with the setting's limits and unit", async () => {
    const user = userEvent.setup();
    updateSettings
      .mockRejectedValueOnce(
        invalid([
          {
            field: "values.platform_fee_percent",
            code: "MAX",
            message: "platform_fee_percent must not be greater than 50",
          },
        ]),
      )
      .mockRejectedValueOnce(
        invalid([
          {
            field: "values.max_photo_upload_mb",
            code: "MIN",
            message: "max_photo_upload_mb must not be less than 1",
          },
        ]),
      );
    const { unmount } = renderWithProviders(
      <SettingsSectionCard sectionKey="commission" items={items} onDirtyChange={() => undefined} />,
    );
    await user.clear(screen.getByLabelText("Platform fee"));
    await user.type(screen.getByLabelText("Platform fee"), "15");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Must be 50 % or less.")).toBeInTheDocument();
    expect(screen.queryByText(/must not be greater than/)).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <SettingsSectionCard sectionKey="uploads" items={[upload]} onDirtyChange={() => undefined} />,
    );
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "5");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Must be 1 MB or more.")).toBeInTheDocument();
  });

  it("an empty required text, in Arabic", async () => {
    const user = userEvent.setup();
    updateSettings.mockRejectedValueOnce(
      invalid([
        {
          field: "values.min_app_version",
          code: "IS_NOT_EMPTY",
          message: "min_app_version must not be empty",
        },
      ]),
    );
    renderWithProviders(
      <SettingsSectionCard sectionKey="maintenance" items={[version]} onDirtyChange={() => undefined} />,
      { locale: "ar" },
    );
    const input = screen.getAllByRole("textbox")[0];
    await user.clear(input);
    await user.type(input, "2.0.0");
    await user.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    expect(await screen.findByText("لا يمكن ترك هذا الحقل فارغًا.")).toBeInTheDocument();
  });
});
