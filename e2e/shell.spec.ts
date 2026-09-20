import { expect, test } from "@playwright/test";

test.describe("Sign in (SHL-03)", () => {
  test("renders /en/login in English (ltr)", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/en/forgot-password",
    );
  });

  test("renders /ar/login in Arabic (rtl)", async ({ page }) => {
    await page.goto("/ar/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1, name: "تسجيل الدخول" })).toBeVisible();
  });

  test("shows validation errors without calling the API", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Required")).toHaveCount(2);
  });

  test("protected routes redirect to login with ?next when signed out", async ({ page }) => {
    await page.goto("/en/bookings?tab=pending");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fbookings%3Ftab%3Dpending/, { timeout: 15_000 });
  });
});
