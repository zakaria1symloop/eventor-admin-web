import { expect, test } from "@playwright/test";
import { apiGet, saveSession, shot, signIn } from "./session";

/**
 * Modules 8 & 11 smoke against the seeded API: bookings list, booking detail + status dialog, invoice modal,
 * messages inbox thread. Shared session (./session.ts) — run with --workers=1. Skips when the API is down.
 */
interface BookingRow {
  id: string;
  reference: string;
  status: string;
  client: { fullName: string };
}

test.describe("Bookings & messages (modules 8, 11)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
  });
  test.afterEach(async ({ page }) => {
    await saveSession(page);
  });

  test("bookings list shows tabs, quick cards, rows and the row menu", async ({ page }) => {
    const list = await apiGet<{ data: BookingRow[]; meta: { counts: { pending: number } } }>(
      page,
      "/admin/bookings?limit=10&sort=createdAt:desc",
    );
    test.skip(list.data.length === 0, "no seeded bookings");
    await page.goto("/en/bookings");
    await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("tab", { name: /Pending/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /No reply 48 h\+/ })).toBeVisible();
    await expect(page.getByText(`#${list.data[0].reference}`).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await shot(page, "bookings-list");

    const row = page
      .getByRole("row")
      .filter({ hasText: `#${list.data[0].reference}` })
      .first();
    await row.getByRole("button", { name: /more|actions/i }).click();
    await expect(page.getByRole("menuitem", { name: "Open booking" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Open conversation" })).toBeVisible();
    await shot(page, "bookings-row-menu");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /No reply 48 h\+/ }).click();
    await expect(page).toHaveURL(/noReply=true/);
  });

  test("booking detail renders and opens the status dialog", async ({ page }) => {
    const list = await apiGet<{ data: BookingRow[] }>(page, "/admin/bookings?tab=pending&limit=1");
    test.skip(list.data.length === 0, "no pending booking");
    const b = list.data[0];
    await page.goto(`/en/bookings/${b.id}`);
    await expect(page.getByRole("heading", { level: 1, name: `Booking #${b.reference}` })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Who and what" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Price & invoice" })).toBeVisible();
    await expect(page.getByText("Provider receives").first()).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "booking-detail");

    await page
      .getByRole("button", { name: /^Decline/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: `Decline booking #${b.reference}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Decline booking" }).click();
    await expect(dialog.getByText("Pick a reason")).toBeVisible();
    await shot(page, "booking-status-dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Reschedule" }).click();
    await expect(page.getByRole("dialog", { name: `Reschedule #${b.reference}` })).toBeVisible();
    await expect(page.getByRole("grid").first()).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, "booking-reschedule");
    await page.keyboard.press("Escape");
  });

  test("invoice modal shows the Eventor invoice", async ({ page }) => {
    const list = await apiGet<{ data: BookingRow[] }>(page, "/admin/bookings?tab=accepted&limit=1");
    test.skip(list.data.length === 0, "no accepted booking");
    const b = list.data[0];
    await page.goto(`/en/bookings/${b.id}?invoice=1`);
    const dialog = page.getByRole("dialog", { name: /^Invoice INV-/ });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText("Billed to")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await page.waitForTimeout(600);
    await shot(page, "booking-invoice");
    await dialog.getByRole("button", { name: "Close" }).last().click();

    await page.goto(`/en/bookings/${b.id}?price=1`);
    await expect(page.getByRole("dialog", { name: "Adjust price" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("price-totals")).toContainText("New total for client");
    await shot(page, "booking-price");
  });

  test("messages inbox opens a thread", async ({ page }) => {
    const list = await apiGet<{
      data: { id: string; participants: { fullName: string; role: string }[]; reportsOpen: number }[];
    }>(page, "/admin/conversations?limit=5&reported=true");
    const fallback =
      list.data.length > 0 ? list : await apiGet<typeof list>(page, "/admin/conversations?limit=5");
    test.skip(fallback.data.length === 0, "no seeded conversations");
    const c = fallback.data[0];
    await page.goto("/en/messages");
    await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("radio", { name: /Reported/ })).toBeVisible();
    await page.goto(`/en/messages/${c.id}`);
    const thread = page.getByRole("region", { name: "Conversation", exact: true });
    const name = c.participants.find((p) => p.role !== "support")?.fullName ?? "";
    await expect(thread.getByRole("link", { name }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("message").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder(/Write as Eventor support/)).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "messages-inbox");

    await page.getByRole("button", { name: "Message a user" }).click();
    await expect(page.getByRole("dialog", { name: "New message" })).toBeVisible();
    await shot(page, "messages-new");
    await page.keyboard.press("Escape");

    const closeOrReopen = thread.getByRole("button", { name: /^(Close conversation|Reopen)$/ }).first();
    test.skip((await closeOrReopen.getAttribute("aria-label")) === "Reopen", "conversation already closed");
    await closeOrReopen.click();
    await expect(page.getByRole("dialog", { name: "Close this conversation?" })).toBeVisible();
    await shot(page, "messages-close");
    await page.keyboard.press("Escape");
  });
});
