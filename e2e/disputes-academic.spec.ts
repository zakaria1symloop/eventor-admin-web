import { expect, test, type Page } from "@playwright/test";
import { API, apiGet, saveSession, shot, signIn } from "./session";

/**
 * Modules 9 & 10 smoke against the seeded API: disputes list + detail + resolve dialog, academic requests list +
 * detail, forms list + builder, public web form in EN / AR (submit blocked until the email code).
 * Shared session (./session.ts) — run with --workers=1. Skips when the API is down.
 */
interface Row {
  id: string;
  reference: string;
}
interface FormRow {
  id: string;
  slug: string;
  nameEn: string;
  status: string;
  isDefault: boolean;
}

test.describe("Disputes & academic requests (modules 9, 10)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
  });
  test.afterEach(async ({ page }) => {
    await saveSession(page);
  });

  test("disputes list shows tabs, quick cards and the row menu", async ({ page }) => {
    const list = await apiGet<{ data: (Row & { status: string })[] }>(
      page,
      "/admin/disputes?tab=all&limit=10",
    );
    test.skip(list.data.length === 0, "no seeded disputes");
    await page.goto("/en/disputes?tab=all");
    await expect(page.getByRole("heading", { level: 1, name: "Disputes" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("tab", { name: /In review/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Resolved · 30 days/ })).toBeVisible();
    const first = list.data[0];
    await expect(page.getByText(first.reference).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot(page, "dsp-01");
    const row = page.getByRole("row").filter({ hasText: first.reference }).first();
    await row.getByRole("button", { name: /more|actions/i }).click();
    await expect(page.getByRole("menuitem", { name: "Assign to me" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Open dispute" }).first().click();
    await expect(page.getByRole("dialog", { name: "Open a dispute" })).toBeVisible();
    await shot(page, "dsp-01-open");
  });

  test("dispute detail renders and opens the resolve dialog", async ({ page }) => {
    const list = await apiGet<{ data: (Row & { status: string })[] }>(
      page,
      "/admin/disputes?tab=all&limit=50",
    );
    const active = list.data.find((d) => d.status === "open" || d.status === "in_review");
    test.skip(!active, "no active dispute");
    await page.goto(`/en/disputes/${active!.id}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(active!.reference) })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Both sides" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Dispute conversation/ })).toBeVisible();
    await expect(page.getByText(/is frozen/)).toBeVisible();
    await page.waitForTimeout(1000);
    await shot(page, "dsp-02");

    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Resolve ${active!.reference}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /Leave unchanged/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Resolve dispute" }).click();
    await expect(dialog.getByText("Pick what happens to the booking.").first()).toBeVisible();
    await shot(page, "dsp-03");
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("academic requests list and detail", async ({ page }) => {
    const list = await apiGet<{ data: (Row & { title: string })[] }>(
      page,
      "/admin/academic-requests?limit=10",
    );
    test.skip(list.data.length === 0, "no seeded requests");
    await page.goto("/en/academic-requests");
    await expect(page.getByRole("heading", { level: 1, name: "Academic requests" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: /Forms/ })).toBeVisible();
    await expect(page.getByText(list.data[0].reference).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot(page, "acr-01");

    const pending = await apiGet<{ data: (Row & { title: string })[] }>(
      page,
      "/admin/academic-requests?tab=pending&limit=1",
    );
    const target = pending.data[0] ?? list.data[0];
    await page.goto(`/en/academic-requests/${target.id}`);
    await expect(page.getByRole("heading", { level: 1, name: target.title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Request details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Requester" })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "acr-02");
    if (pending.data[0]) {
      await page.getByRole("button", { name: "Ask for changes" }).click();
      const dialog = page.getByRole("dialog", { name: "Ask for changes" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("checkbox").first()).toBeVisible();
      await shot(page, "acr-04");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("button", { name: "Approve request" }).click();
      await expect(page.getByRole("dialog", { name: /Approve/ })).toBeVisible();
      await shot(page, "acr-03");
    }
  });

  test("forms list and builder load", async ({ page }) => {
    const list = await apiGet<{ data: FormRow[] }>(page, "/admin/forms?limit=10");
    test.skip(list.data.length === 0, "no seeded forms");
    await page.goto("/en/academic-requests/forms");
    await expect(page.getByRole("heading", { level: 1, name: "Request forms" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(list.data[0].nameEn).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot(page, "acr-05");

    const form = list.data.find((f) => f.isDefault) ?? list.data[0];
    await page.goto(`/en/academic-requests/forms/${form.id}/edit`);
    await expect(page.getByRole("heading", { name: "Add a field" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("canvas-field").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Publish v\d+/ })).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "acr-06");
  });

  test("public web form renders in en and ar and needs the email code", async ({ page, browser }) => {
    const list = await apiGet<{ data: FormRow[] }>(page, "/admin/forms?tab=published&limit=10");
    const form = list.data.find((f) => f.isDefault) ?? list.data[0];
    test.skip(!form, "no published form");
    const res = await page.request.get(`${API}/forms/${form.slug}`);
    test.skip(!res.ok(), "public form unavailable");

    // A fresh context: no admin cookies (and the shared session file keeps its refresh cookie).
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pub = await context.newPage();
    await runPublic(pub, form.slug);
    await context.close();
  });

  test("public form email step blocks submit until a code is sent", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await runMini(page);
    await context.close();
  });
});

/** EN renders and validates, AR is right-to-left (public page, no admin cookies). */
async function runPublic(page: Page, slug: string) {
  await page.goto(`/en/f/${slug}`);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("progressbar").first()).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("This question is required.").first()).toBeVisible();
  await shot(page, "acr-07-en");

  await page.goto(`/ar/f/${slug}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "التالي" })).toBeVisible({ timeout: 20_000 });
  await shot(page, "acr-07-ar");
}

/** A one-section form (intercepted): the email step keeps "Send request" disabled until a code is sent. */
async function runMini(page: Page) {
  await page.route("**/api/v1/forms/e2e-mini", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          slug: "e2e-mini",
          nameEn: "Mini form",
          nameAr: "نموذج مصغر",
          descriptionEn: null,
          descriptionAr: null,
          version: 1,
          schema: {
            fields: [
              {
                key: "title",
                type: "short_text",
                label_en: "Event title",
                label_ar: "عنوان",
                required: true,
              },
            ],
          },
          requiresAuth: false,
          maxSubmissionsPerEmailPerMonth: null,
          confirmationEn: "Thanks",
          confirmationAr: "شكرا",
          uploadMaxMb: 5,
        },
      }),
    }),
  );
  await page.goto("/en/f/e2e-mini");
  await page.getByLabel("Event title").fill("Science Day");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
  await page.getByLabel("Email").fill("nadia@univ-alger.dz");
  await expect(page.getByRole("button", { name: "Send code" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
  await shot(page, "acr-07-email");
}
