import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDirection } from "@/i18n/routing";
import { renderWithProviders } from "@/test/render";
import { LanguageSwitch } from "./language-switch";

const replace = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/users",
  useRouter: () => ({ replace, push: vi.fn() }),
}));

describe("LanguageSwitch", () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState(null, "", "/en/users?tab=providers&page=2");
  });

  it("switches to Arabic keeping the path and query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSwitch />, { locale: "en" });

    expect(screen.getByRole("radio", { name: "EN" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "عربي" }));
    expect(replace).toHaveBeenCalledWith("/users?tab=providers&page=2", { locale: "ar", scroll: false });
  });

  it("marks Arabic as current in the ar locale and does nothing when re-selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSwitch />, { locale: "ar" });
    expect(screen.getByRole("radiogroup", { name: "تغيير اللغة" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "عربي" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "عربي" }));
    expect(replace).not.toHaveBeenCalled();
  });

  it("maps locales to text direction", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });
});
