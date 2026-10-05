import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api/errors";
import { LoginForm } from "./login-form";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/login",
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const loginMock = vi.fn();
vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>();
  return { ...actual, login: (...args: unknown[]) => loginMock(...args) };
});

const user = {
  id: "u1",
  fullName: "Sara Meziane",
  email: "sara@eventor.dz",
  language: "en",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  lastActiveAt: null,
};

function apiError(status: number, code: string, message: string, details?: unknown) {
  return new ApiError({ status, code, message, details });
}

async function fill(
  u: ReturnType<typeof userEvent.setup>,
  email = "sara@eventor.dz",
  password = "Secret12345",
) {
  await u.type(screen.getByLabelText("Email"), email);
  await u.type(screen.getByLabelText("Password"), password);
  await u.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  replace.mockReset();
  loginMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("LoginForm", () => {
  it("validates required fields and email format without calling the API", async () => {
    const u = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findAllByText("Required")).toHaveLength(2);

    await u.type(screen.getByLabelText("Email"), "not-an-email");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("signs in and redirects to a safe ?next path", async () => {
    loginMock.mockResolvedValue({ accessToken: "tok", expiresIn: 900, user });
    const u = userEvent.setup();
    renderWithProviders(<LoginForm next="/en/bookings?tab=pending" />);
    await u.type(screen.getByLabelText("Email"), "sara@eventor.dz");
    await u.type(screen.getByLabelText("Password"), "Secret12345");
    await u.click(screen.getByRole("checkbox", { name: /Keep me signed in/ }));
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/bookings?tab=pending"));
    expect(loginMock).toHaveBeenCalledWith({
      email: "sara@eventor.dz",
      password: "Secret12345",
      remember: true,
    });
  });

  it("ignores an external ?next", async () => {
    loginMock.mockResolvedValue({ accessToken: "tok", expiresIn: 900, user });
    const u = userEvent.setup();
    renderWithProviders(<LoginForm next="//evil.example" />);
    await fill(u);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("maps INVALID_CREDENTIALS under the password and VALIDATION_FAILED details onto fields", async () => {
    const u = userEvent.setup();
    renderWithProviders(<LoginForm />);

    loginMock.mockRejectedValueOnce(
      apiError(401, "INVALID_CREDENTIALS", "Wrong email or password. 3 attempts left before a 15 min lock."),
    );
    await fill(u);
    const pwError = await screen.findByText(/3 attempts left/);
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(pwError).toHaveAttribute("role", "alert");

    loginMock.mockRejectedValueOnce(
      apiError(400, "VALIDATION_FAILED", "Invalid", [
        { field: "email", code: "isEmail", message: "Email must be an email" },
      ]),
    );
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Email must be an email")).toBeInTheDocument();
  });

  it("explains a sign-out caused by signing in on another computer (?reason=replaced)", () => {
    renderWithProviders(<LoginForm signedInElsewhere />);
    expect(screen.getByText(/signed in on another computer/)).toBeInTheDocument();
  });

  it("shows no such banner on a plain visit", () => {
    renderWithProviders(<LoginForm />);
    expect(screen.queryByText(/signed in on another computer/)).not.toBeInTheDocument();
  });

  it("shows banners for blocked accounts and an unreachable API", async () => {
    const u = userEvent.setup();
    renderWithProviders(<LoginForm />);
    loginMock.mockRejectedValueOnce(apiError(403, "ACCOUNT_BLOCKED", "Blocked"));
    await fill(u);
    expect(
      await screen.findByText("This admin account is blocked. Contact another admin."),
    ).toBeInTheDocument();

    loginMock.mockRejectedValueOnce(apiError(0, "NETWORK_ERROR", "Failed to fetch"));
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Can't reach the Eventor API/)).toBeInTheDocument();
  });

  it("locks the form with a countdown on ACCOUNT_LOCKED", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<LoginForm />);
    loginMock.mockRejectedValueOnce(apiError(429, "ACCOUNT_LOCKED", "Locked", { retryAfterSeconds: 65 }));
    await fill(u);

    expect(await screen.findByText("Sign-in is locked. Try again in 1:05.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Locked · 1:05" });
    expect(button).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("button", { name: /Locked · 1:0[01]/ })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
    expect(screen.queryByText(/Sign-in is locked/)).not.toBeInTheDocument();
  });
});
