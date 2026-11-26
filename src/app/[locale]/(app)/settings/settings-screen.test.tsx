import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { SettingItem, SettingsSection } from "@/lib/api/settings";
import { SettingsScreen } from "./settings-screen";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
// The admin accounts block has its own API and tests; here only its anchor matters.
vi.mock("./admin-accounts", () => ({
  AdminAccountsSection: ({ id }: { id: string }) => <section id={id}>Admin accounts</section>,
}));

const at = "2026-11-20T10:00:00.000Z";
const text = (key: string, value: string): SettingItem => ({
  key,
  value,
  type: "text",
  min: null,
  max: null,
  maxLength: 60_000,
  sensitive: false,
  updatedAt: at,
  updatedBy: null,
});
const legal: SettingItem[] = [
  text("legal_terms_en", "## Terms\nUse Eventor fairly."),
  text("legal_terms_ar", "## الشروط"),
  text("legal_privacy_en", "## Privacy\nWe keep little."),
  text("legal_privacy_ar", "## الخصوصية"),
];
const sections: SettingsSection[] = [
  {
    key: "commission",
    settings: [
      {
        key: "platform_fee_percent",
        value: 10,
        type: "decimal",
        min: 0,
        max: 50,
        sensitive: true,
        updatedAt: at,
        updatedBy: null,
      },
    ],
  },
  { key: "bookings", settings: [] },
  { key: "uploads", settings: [] },
  { key: "languages", settings: [] },
  { key: "notifications", settings: [] },
  { key: "support", settings: [] },
  { key: "legal", settings: legal },
  { key: "maintenance", settings: [] },
];

const updateSettings = vi.fn();
vi.mock("@/lib/api/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/settings")>()),
  getSettings: () => Promise.resolve({ sections }),
  updateSettings: (...args: unknown[]) => updateSettings(...args),
}));

describe("Settings page sections", () => {
  it("every link of the section nav points to a section on the page (EN and AR)", async () => {
    for (const locale of ["en", "ar"] as const) {
      const { container, unmount } = renderWithProviders(<SettingsScreen />, { locale });
      await waitFor(() => expect(container.querySelector("#commission")).not.toBeNull());
      const nav = container.querySelector("nav");
      const anchors = [...(nav?.querySelectorAll("a[href^='#']") ?? [])].map((a) =>
        a.getAttribute("href")!.slice(1),
      );
      expect(anchors).toContain("legal");
      for (const id of anchors)
        expect(container.querySelector(`#${id}`), `#${id} (${locale})`).not.toBeNull();
      unmount();
    }
  });

  it("Settings › Legal edits the terms and saves only the changed text, with its loaded version", async () => {
    const user = userEvent.setup();
    updateSettings.mockResolvedValueOnce({
      sections: [
        {
          key: "legal",
          settings: [{ ...legal[0], value: "## Terms\nUse Eventor fairly. Updated." }, ...legal.slice(1)],
        },
      ],
    });
    const { container } = renderWithProviders(<SettingsScreen />);
    await waitFor(() => expect(container.querySelector("#legal")).not.toBeNull());
    const card = container.querySelector<HTMLElement>("#legal")!;

    expect(within(card).getByText("Legal pages")).toBeInTheDocument();
    const boxes = within(card).getAllByRole("textbox", { hidden: true }) as HTMLTextAreaElement[];
    expect(boxes.map((b) => b.value)).toEqual(
      expect.arrayContaining([
        "## Terms\nUse Eventor fairly.",
        "## الشروط",
        "## Privacy\nWe keep little.",
        "## الخصوصية",
      ]),
    );

    const termsEn = boxes.find((b) => b.value === "## Terms\nUse Eventor fairly.")!;
    await user.type(termsEn, " Updated.");
    await user.click(within(card).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { legal_terms_en: "## Terms\nUse Eventor fairly. Updated." },
        expectedUpdatedAt: { legal_terms_en: at },
      }),
    );
  });
});
