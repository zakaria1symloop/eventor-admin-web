import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api/errors";
import { ResetPasswordForm } from "./reset-form";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const resetPassword = vi.fn();
vi.mock("@/lib/api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/auth")>()),
  resetPassword: (...a: unknown[]) => resetPassword(...a),
}));

async function submit(password = "Sunflower42x") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm password"), password);
  await user.click(screen.getByRole("button", { name: "Change password" }));
}

describe("BUG-L3 /reset-password", () => {
  // Braces matter: a function returned from beforeEach is run as a teardown hook (mockReset returns the mock).
  beforeEach(() => {
    resetPassword.mockReset();
  });

  it("410 RESET_TOKEN_EXPIRED → 'This link has expired'", async () => {
    resetPassword.mockRejectedValue(new ApiError({ status: 410, code: "RESET_TOKEN_EXPIRED", message: "x" }));
    renderWithProviders(<ResetPasswordForm token="tok" />);
    await submit();
    expect(await screen.findByText("This link has expired")).toBeInTheDocument();
    expect(screen.queryByText("This link is not valid or was already used")).not.toBeInTheDocument();
  });

  it("400 RESET_TOKEN_INVALID → 'not valid or already used'", async () => {
    resetPassword.mockRejectedValue(new ApiError({ status: 400, code: "RESET_TOKEN_INVALID", message: "x" }));
    renderWithProviders(<ResetPasswordForm token="tok" />);
    await submit();
    expect(await screen.findByText("This link is not valid or was already used")).toBeInTheDocument();
    expect(screen.queryByText("This link has expired")).not.toBeInTheDocument();
  });

  it("no token → 'not valid', nothing sent", () => {
    renderWithProviders(<ResetPasswordForm token="" />);
    expect(screen.getByText("This link is not valid or was already used")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("success shows the neutral text for admins and app users, without redirecting", async () => {
    resetPassword.mockResolvedValue(undefined);
    renderWithProviders(<ResetPasswordForm token="tok" />);
    await submit();
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith("tok", "Sunflower42x"));
    expect(await screen.findByText("Your password has been changed")).toBeInTheDocument();
    expect(screen.getByText("Sign in again on the dashboard or in the Eventor app.")).toBeInTheDocument();
  });

  it("renders the expired message in Arabic", async () => {
    resetPassword.mockRejectedValue(new ApiError({ status: 410, code: "RESET_TOKEN_EXPIRED", message: "x" }));
    renderWithProviders(<ResetPasswordForm token="tok" />, { locale: "ar" });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("كلمة المرور الجديدة"), "Sunflower42x");
    await user.type(screen.getByLabelText("تأكيد كلمة المرور"), "Sunflower42x");
    await user.click(screen.getByRole("button", { name: "تغيير كلمة المرور" }));
    expect(await screen.findByText("انتهت صلاحية هذا الرابط")).toBeInTheDocument();
  });
});
