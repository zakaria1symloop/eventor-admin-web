import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Shared admin session for every spec (the auth endpoints are throttled at 10 req/min).
 * Signs in through the API once per run, then persists the access token and the (rotating) refresh cookie
 * to `e2e/.auth/session.json` so later tests — and later spec files, even after a worker restart — reuse it.
 * Call `signIn(page)` in `beforeEach` and `saveSession(page)` in `afterEach`. Run with `--workers=1`.
 */
export const API = (process.env.E2E_API_URL ?? "http://localhost:3000/api/v1").replace(/\/$/, "");
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@eventor.dz";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin12345!";
const SHOTS = process.env.E2E_SCREENSHOTS;
const FILE = path.join(__dirname, ".auth", "session.json");
/** Access tokens live 15 min on the API; refresh a bit earlier. */
const TOKEN_TTL_MS = 10 * 60_000;

type Cookies = Parameters<BrowserContext["addCookies"]>[0];
interface Session {
  token: string;
  cookies: Cookies;
  at: number;
}

let session: Session | null = null;

function load(): Session | null {
  if (session) return session;
  try {
    session = JSON.parse(fs.readFileSync(FILE, "utf8")) as Session;
  } catch {
    session = null;
  }
  return session;
}

function persist(next: Session) {
  session = next;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next));
}

async function post(page: Page, url: string, data?: unknown) {
  try {
    return await page.request.post(url, { data, timeout: 5_000 });
  } catch {
    return null;
  }
}

/** Returns the admin access token (skips the test when the API is down). */
export async function signIn(page: Page): Promise<string | null> {
  const saved = load();
  if (saved) {
    await page.context().addCookies(saved.cookies);
    if (Date.now() - saved.at < TOKEN_TTL_MS) return saved.token;
    // Token is stale: rotate through the refresh cookie instead of logging in again.
    const res = await post(page, `${API}/admin/auth/refresh`);
    if (res?.ok()) {
      const token = ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
      persist({ token, cookies: await page.context().cookies(), at: Date.now() });
      return token;
    }
    await page.context().clearCookies();
  }
  const res = await post(page, `${API}/admin/auth/login`, {
    email: EMAIL,
    password: PASSWORD,
    remember: true,
  });
  if (!res) {
    test.skip(true, `API not reachable at ${API}`);
    return null;
  }
  test.skip(!res.ok(), `API login failed (${res.status()})`);
  const token = ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
  persist({ token, cookies: await page.context().cookies(), at: Date.now() });
  return token;
}

/** The dashboard rotates the refresh cookie while a test runs: keep the latest one for the next test. */
export async function saveSession(page: Page) {
  const saved = load();
  if (!saved) return;
  const cookies = await page.context().cookies();
  if (cookies.length) persist({ ...saved, cookies });
}

export async function apiGet<T>(page: Page, apiPath: string): Promise<T> {
  const res = await page.request.get(`${API}${apiPath}`, {
    headers: { Authorization: `Bearer ${load()?.token}` },
  });
  expect(res.ok(), `${apiPath} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

export async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
