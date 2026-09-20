import { expect, test } from "@playwright/test";
import { saveSession, shot, signIn } from "./session";

/** Modules 2–3 smoke: settings and categories render for a signed-in admin (shared session, ./session.ts). */
test.describe("Setup screens (modules 2–3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
  });
  test.afterEach(async ({ page }) => {
    await saveSession(page);
  });

  test("settings page renders its sections", async ({ page }) => {
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Commission & pricing" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Platform fee")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin accounts" })).toBeVisible();
    await shot(page, "settings");
  });

  test("categories page renders the list", async ({ page }) => {
    await page.goto("/en/categories");
    await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("tab", { name: /All/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add category" }).first()).toBeVisible();
    await shot(page, "categories");
  });

  test("activity log and locations render", async ({ page }) => {
    await page.goto("/en/activity-log");
    await expect(page.getByRole("heading", { level: 1, name: "Activity log" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("tab", { name: /Admin actions/ })).toBeVisible();
    await page.waitForTimeout(1500);
    await shot(page, "activity-log");
    await page.goto("/en/locations");
    await expect(page.getByRole("heading", { level: 1, name: "Locations" })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    await shot(page, "locations");
  });
});
