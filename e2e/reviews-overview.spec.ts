import { expect, test } from "@playwright/test";
import { apiGet, saveSession, shot, signIn } from "./session";

/**
 * Modules 12 & 13 smoke against the seeded API: overview charts, global search exact match, notifications panel,
 * reviews list + moderation drawer + reports queue. Shared session (./session.ts) — run with --workers=1.
 */
interface ReviewRow {
  id: string;
  author: { fullName: string };
  booking: { reference: string };
  reportsOpen: number;
  detectedFlags: string[];
}

test.describe("Overview, search, notifications, reviews (modules 12, 13)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
  });
  test.afterEach(async ({ page }) => {
    await saveSession(page);
  });

  test("overview renders the attention queue, KPIs and charts", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: "Needs your attention" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: /Accounts to verify/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "Bookings per day" })).toBeVisible();
    expect(await page.getByTestId("chart-bar").count()).toBeGreaterThanOrEqual(28);
    await expect(page.getByRole("heading", { name: "Bookings by status" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest bookings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await shot(page, "ovr-01");

    await page.getByRole("button", { name: /Last 30 days/ }).click();
    await page.getByRole("option", { name: "Last 7 days" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(page.getByRole("button", { name: /Last 7 days/ })).toBeVisible();
    await expect.poll(() => page.getByTestId("chart-bar").count(), { timeout: 15_000 }).toBe(7);
  });

  test("global search jumps to an exact booking reference", async ({ page }) => {
    const res = await apiGet<{ data: { exactMatch: { href: string } | null } }>(
      page,
      "/admin/search?q=EVT-002041",
    );
    test.skip(!res.data.exactMatch, "EVT-002041 is not seeded");
    await page.goto("/en/reviews");
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Control+k");
    const box = page.getByRole("combobox", { name: /Search users/ });
    await expect(box).toBeVisible();
    await box.fill("EVT-002041");
    await expect(page.getByRole("option", { name: /EVT-002041/ })).toBeVisible({ timeout: 15_000 });
    await shot(page, "shl-01");
    await box.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${res.data.exactMatch!.href}$`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: /EVT-002041/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("notifications panel lists notifications", async ({ page }) => {
    await page.goto("/en/reviews");
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "Mark all as read" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Notification settings" })).toBeVisible();
    await expect(panel.locator("li button").first().or(panel.getByText("You're all caught up"))).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, "shl-02");
  });

  test("reviews list opens the moderation drawer and the reports queue", async ({ page }) => {
    const list = await apiGet<{ data: ReviewRow[] }>(page, "/admin/reviews?limit=50");
    test.skip(list.data.length === 0, "no seeded reviews");
    const target = list.data.find((r) => r.reportsOpen > 0) ?? list.data[0];

    await page.goto("/en/reviews");
    await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("tab", { name: /Reported/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Average rating/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /This week/ })).toBeVisible();
    await shot(page, "rev-01");

    await page.goto(`/en/reviews?review=${target.id}`);
    const drawer = page.getByRole("dialog", { name: new RegExp(target.booking.reference) });
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByText(target.author.fullName).first()).toBeVisible();
    if (target.reportsOpen > 0) await expect(drawer.getByRole("heading", { name: "Decision" })).toBeVisible();
    await shot(page, "rev-02");
    await drawer.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete review" }).click();
    await expect(page.getByRole("dialog", { name: "Delete this review?" })).toBeVisible();
    await shot(page, "rev-03");
    await page
      .getByRole("dialog", { name: "Delete this review?" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await page.goto("/en/reviews?view=reports");
    await expect(page.getByRole("tab", { name: /Dismissed/ })).toBeVisible({ timeout: 20_000 });
    await shot(page, "rev-reports");
  });
});
