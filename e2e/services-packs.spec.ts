import { expect, test } from "@playwright/test";
import { apiGet, saveSession, shot, signIn } from "./session";

/**
 * Modules 6–7 smoke against the seeded API: services list, service detail, service edit (photos), packs list/detail.
 * Signs in once per run (shared session, ./session.ts — run with --workers=1). Skips when the API is down.
 */
interface Row {
  id: string;
  titleEn: string;
  provider: { businessName: string | null; fullName: string };
}

test.describe("Services & Ready Packs (modules 6–7)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
  });
  // Refresh tokens rotate: carry the latest cookie into the next test instead of signing in again.
  test.afterEach(async ({ page }) => {
    await saveSession(page);
  });

  test("services list shows seeded rows, tabs, quick cards and row menu", async ({ page }) => {
    const list = await apiGet<{ data: Row[] }>(page, "/admin/services?limit=10&sort=createdAt:desc");
    test.skip(list.data.length === 0, "no seeded services");
    await page.goto("/en/services");
    await expect(page.getByRole("heading", { level: 1, name: "Services" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("tab", { name: /Published/ })).toBeVisible();
    await expect(page.getByText(list.data[0].titleEn).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await shot(page, "services-list");

    const row = page.getByRole("row").filter({ hasText: list.data[0].titleEn }).first();
    await row.getByRole("button", { name: /more|actions/i }).click();
    await expect(page.getByRole("menuitem", { name: "Open provider" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete service" })).toBeVisible();
    await shot(page, "services-row-menu");
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: /Hidden/ }).click();
    await expect(page).toHaveURL(/tab=hidden/);
  });

  test("service detail renders content, provider card, availability and hide dialog", async ({ page }) => {
    const list = await apiGet<{ data: Row[] }>(page, "/admin/services?limit=1&tab=published");
    test.skip(list.data.length === 0, "no published services");
    const s = list.data[0];
    await page.goto(`/en/services/${s.id}`);
    await expect(page.getByRole("heading", { level: 1, name: s.titleEn })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Title & description")).toBeVisible();
    await expect(page.getByText("Visibility & moderation")).toBeVisible();
    await expect(page.locator("[lang=ar]").first()).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "service-detail");

    await page.getByRole("button", { name: "Hide service" }).first().click();
    await expect(page.getByRole("dialog")).toContainText(`Hide “${s.titleEn}”?`);
    await shot(page, "service-hide-dialog");
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete service" }).click();
    await expect(page.getByRole("dialog")).toContainText("Delete this service?");
    await shot(page, "service-delete-dialog");
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("tab", { name: "Availability" }).click();
    await expect(page.getByRole("grid").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
    await shot(page, "service-availability");
  });

  test("service edit loads the photos and the bilingual form", async ({ page }) => {
    const list = await apiGet<{ data: Row[] }>(page, "/admin/services?limit=1&tab=published");
    test.skip(list.data.length === 0, "no published services");
    const detail = await apiGet<{ data: { photos: unknown[] } }>(page, `/admin/services/${list.data[0].id}`);
    await page.goto(`/en/services/${list.data[0].id}/edit`);
    await expect(page.getByRole("heading", { level: 1, name: "Edit service" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("tab", { name: /English/ }).first()).toBeVisible();
    const photos = page.getByTestId("service-photos");
    await expect(photos.getByText(`${detail.data.photos.length} / `)).toBeVisible();
    await expect(photos.locator("img")).toHaveCount(detail.data.photos.length);
    await page.waitForTimeout(800);
    await shot(page, "service-edit");

    // Unsaved changes guard (STA-06).
    await page.getByRole("textbox").first().fill("Changed title");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "service-unsaved");
    await page.getByRole("button", { name: "Keep editing" }).click();
  });

  test("packs list and pack detail", async ({ page }) => {
    const list = await apiGet<{ data: { id: string; nameEn: string }[] }>(page, "/admin/packs?limit=10");
    test.skip(list.data.length === 0, "no seeded packs");
    await page.goto("/en/packs");
    await expect(page.getByRole("heading", { level: 1, name: "Ready Packs" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("tab", { name: /Need attention/ })).toBeVisible();
    await expect(page.getByText(list.data[0].nameEn).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await shot(page, "packs-list");

    await page.getByText(list.data[0].nameEn).first().click();
    await expect(page.getByRole("heading", { level: 1, name: list.data[0].nameEn })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Services in this pack")).toBeVisible();
    await expect(page.getByText("Services separately").first()).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "pack-detail");

    await page.goto(`/en/packs/${list.data[0].id}/edit`);
    await expect(page.getByText("Before publishing")).toBeVisible({ timeout: 20_000 });
    await shot(page, "pack-edit");
  });
});
