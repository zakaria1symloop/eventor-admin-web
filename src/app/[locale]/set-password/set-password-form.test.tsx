import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api/errors";
import { newPasswordSchema } from "@/lib/auth/password-schema";
import { SetPasswordForm } from "./set-password-form";

const checkSetPasswordLink = vi.fn();
const setAppPassword = vi.fn();
const getStoreUrls = vi.fn();
vi.mock("@/lib/api/app-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/app-auth")>()),
  checkSetPasswordLink: (...a: unknown[]) => checkSetPasswordLink(...a),
  setAppPassword: (...a: unknown[]) => setAppPassword(...a),
  getStoreUrls: (...a: unknown[]) => getStoreUrls(...a),
}));

const LINK = { firstName: "Amel", emailHint: "a***@gmail.com", expiresAt: "2026-12-02T10:00:00.000Z" };
/** E-mail addresses are wrapped in LTR isolates (U+2066 … U+2069) so they read correctly in Arabic. */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);
const isolated = (email: string) => `${LRI}${email}${PDI}`;
/** Matches a leaf element whose text, isolates removed, is exactly `text`. */
const plain = (text: string) => (_: string, el: Element | null) =>
  !!el && el.children.length === 0 && (el.textContent ?? "").split(LRI).join("").split(PDI).join("") === text;
const apiError = (status: number, code: string, details?: unknown) =>
  new ApiError({ status, code, message: code, details });

async function fill(password: string, confirm = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  await user.click(screen.getByRole("button", { name: "Set my password" }));
}

describe("BUG-L4 /set-password", () => {
  beforeEach(() => {
    checkSetPasswordLink.mockReset();
    setAppPassword.mockReset();
    getStoreUrls.mockReset();
  });

  it("without a token says the link is not valid, without calling the API", () => {
    renderWithProviders(<SetPasswordForm token="" />);
    expect(screen.getByText("This link is not valid or was already used")).toBeInTheDocument();
    expect(checkSetPasswordLink).not.toHaveBeenCalled();
  });

  it("greets the person, checks the rules before sending, then shows the app sign-in and store links", async () => {
    checkSetPasswordLink.mockResolvedValue(LINK);
    setAppPassword.mockResolvedValue({ email: "amel.k@gmail.com" });
    getStoreUrls.mockResolvedValue({ android: "https://play.google.com/store/apps/details?id=x", ios: null });
    renderWithProviders(<SetPasswordForm token="tok" />);

    const hello = await screen.findByText(plain("Hello Amel, choose a password for a***@gmail.com."));
    expect(hello.textContent).toContain(isolated("a***@gmail.com"));
    expect(checkSetPasswordLink).toHaveBeenCalledWith("tok");

    await fill("short1");
    expect(
      await screen.findByText("Use at least 10 characters with a letter and a number"),
    ).toBeInTheDocument();
    expect(setAppPassword).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Password"));
    await user.clear(screen.getByLabelText("Confirm password"));
    await fill("Sunflower42x");
    await waitFor(() => expect(setAppPassword).toHaveBeenCalledWith("tok", "Sunflower42x"));
    expect(await screen.findByText("Your password is set")).toBeInTheDocument();
    expect(
      screen.getByText(plain("Open the Eventor app and sign in with amel.k@gmail.com.")),
    ).toHaveTextContent(isolated("amel.k@gmail.com"));
    expect(await screen.findByRole("link", { name: "Get it on Google Play" })).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=x",
    );
    expect(screen.queryByRole("link", { name: "Download on the App Store" })).not.toBeInTheDocument();
  });

  it("the app password rule: 10–128 characters with a letter and a digit", () => {
    const tv = (k: string, v?: Record<string, string | number>) => (v ? `${k}:${JSON.stringify(v)}` : k);
    const schema = newPasswordSchema(tv, { max: 128 });
    const check = (p: string) => schema.safeParse({ password: p, confirm: p });
    expect(check(`${"a1".repeat(64)}`).success).toBe(true); // 128
    const tooLong = check(`${"a1".repeat(64)}b`); // 129
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe('passwordTooLong:{"max":128}');
    expect(check("abcdefghij").success).toBe(false); // no digit
    expect(check("1234567890").success).toBe(false); // no letter
    expect(check("abc123").success).toBe(false); // too short
    // the admin pages keep their rule (no upper limit)
    expect(
      newPasswordSchema(tv).safeParse({ password: `${"a1".repeat(80)}`, confirm: `${"a1".repeat(80)}` })
        .success,
    ).toBe(true);
  });

  it.each([
    [400, "RESET_TOKEN_INVALID", "This link is not valid or was already used"],
    [410, "RESET_TOKEN_EXPIRED", "This link has expired, ask Eventor for a new one"],
  ])("check %i %s → %s", async (status, code, text) => {
    checkSetPasswordLink.mockRejectedValue(apiError(status, code));
    renderWithProviders(<SetPasswordForm token="tok" />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("check 403 ACCOUNT_BLOCKED shows the blocked message with its reason", async () => {
    checkSetPasswordLink.mockRejectedValue(
      apiError(403, "ACCOUNT_BLOCKED", { reasonLabel: "Fraud suspicion", message: "Contact support." }),
    );
    renderWithProviders(<SetPasswordForm token="tok" />);
    expect(await screen.findByText("This account is blocked")).toBeInTheDocument();
    expect(screen.getByText("Reason: Fraud suspicion")).toBeInTheDocument();
    expect(screen.getByText("Contact support.")).toBeInTheDocument();
  });

  it("a link used meanwhile (submit answers 400) switches to 'not valid'", async () => {
    checkSetPasswordLink.mockResolvedValue(LINK);
    setAppPassword.mockRejectedValue(apiError(400, "RESET_TOKEN_INVALID"));
    renderWithProviders(<SetPasswordForm token="tok" />);
    await screen.findByText(/Hello Amel/);
    await fill("Sunflower42x");
    expect(await screen.findByText("This link is not valid or was already used")).toBeInTheDocument();
  });

  it("renders in Arabic", async () => {
    checkSetPasswordLink.mockResolvedValue(LINK);
    renderWithProviders(<SetPasswordForm token="tok" />, { locale: "ar" });
    expect(
      await screen.findByText(plain("مرحبًا Amel، اختر كلمة مرور للحساب a***@gmail.com.")),
    ).toHaveTextContent(isolated("a***@gmail.com"));
    expect(screen.getByRole("button", { name: "تعيين كلمة المرور" })).toBeInTheDocument();
  });
});
