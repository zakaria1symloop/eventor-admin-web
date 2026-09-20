import { expect, test } from "@playwright/test";
import { apiGet, saveSession, shot, signIn } from "./session";

/**
 * Modules 4–5 smoke against the seeded API: users list, provider profile, verification review.
 * Signs in once per run (shared session, see ./session.ts — run with --workers=1). Skips when the API is down.
 */
test.describe("Users & verifications (modules 4–5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
  });
  test.afterEach(async ({ page }) => {
    await saveSession(page);
  });

  test("users list renders seeded rows, tabs and filters", async ({ page }) => {
    const list = await apiGet<{ data: { fullName: string }[]; meta: { counts: { all: number } } }>(
      page,
      "/admin/users?limit=10&sort=createdAt:desc",
    );
    test.skip(list.data.length === 0, "no seeded users");
    await page.goto("/en/users");
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("tab", { name: /Providers/ })).toBeVisible();
    await expect(page.getByText(list.data[0].fullName).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Active accounts/ })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "users-list");

    await page.getByRole("button", { name: "More filters" }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await shot(page, "users-filters");
    await page.keyboard.press("Escape");

    await page.goto("/en/users?new=1");
    await expect(page.getByRole("dialog", { name: "Add user" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("radio", { name: "Provider" }).click();
    await expect(page.getByLabel("Business name")).toBeVisible();
    await shot(page, "users-add");
  });

  test("provider profile renders overview, documents and actions", async ({ page }) => {
    const list = await apiGet<{ data: { id: string; fullName: string }[] }>(
      page,
      "/admin/users?tab=providers&verificationStatus=verified&limit=1",
    );
    test.skip(list.data.length === 0, "no seeded provider");
    const provider = list.data[0];
    await page.goto(`/en/users/${provider.id}`);
    await expect(page.getByRole("heading", { level: 1, name: provider.fullName })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Account details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Internal notes" })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "user-provider");

    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Reset password" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Block account" }).click();
    const block = page.getByRole("dialog", { name: `Block ${provider.fullName}?` });
    await expect(block).toBeVisible();
    await expect(block.getByText("Signed out on every device")).toBeVisible({ timeout: 10_000 });
    await shot(page, "user-block");
    await page.keyboard.press("Escape");

    await page.goto(`/en/users/${provider.id}?edit=1`);
    await expect(page.getByRole("dialog", { name: "Edit details" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "user-edit");
  });

  test("client profile renders", async ({ page }) => {
    const list = await apiGet<{ data: { id: string; fullName: string }[] }>(
      page,
      "/admin/users?tab=clients&limit=1",
    );
    test.skip(list.data.length === 0, "no seeded client");
    await page.goto(`/en/users/${list.data[0].id}`);
    await expect(page.getByRole("heading", { level: 1, name: list.data[0].fullName })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Recent bookings" })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "user-client");
  });

  test("verification queue and review render", async ({ page }) => {
    const list = await apiGet<{ data: { user: { id: string; fullName: string } }[] }>(
      page,
      "/admin/verifications?tab=resubmitted&limit=1",
    );
    await page.goto("/en/verifications");
    await expect(page.getByRole("heading", { level: 1, name: "Verifications" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("tab", { name: /Waiting/ })).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, "verifications-list");

    test.skip(list.data.length === 0, "no resubmitted provider in the seed");
    const row = list.data[0].user;
    await page.goto(`/en/verifications/${row.id}?tab=resubmitted`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(row.fullName) })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Check against the account" })).toBeVisible();
    await expect(page.getByRole("listbox", { name: "Documents" }).getByRole("option")).toHaveCount(3);
    await page.waitForTimeout(1500);
    await shot(page, "verification-review");

    await page.keyboard.press("r");
    const reject = page.getByRole("dialog", { name: /^Reject / });
    await expect(reject).toBeVisible();
    await reject.getByRole("radio", { name: "Expired" }).click();
    await expect(reject.getByRole("textbox")).toHaveValue(/has expired/);
    await shot(page, "verification-reject");
    await page.keyboard.press("Escape");
  });
});
