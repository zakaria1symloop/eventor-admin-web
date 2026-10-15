/**
 * Public legal pages and the web account deletion (store requirements).
 * `GET /public/legal/{terms|privacy}` — texts edited in Settings · Legal.
 * `POST /app/auth/delete-account { email, password }` → 204, same deletion as the app's Profile · Delete account.
 */
import { api, API_URL, type DataResponse } from "./client";

export type LegalDoc = "terms" | "privacy";

export interface LegalPage {
  doc: LegalDoc;
  lang: "en" | "ar";
  title: string;
  body: string;
  updatedAt: string;
}

/** Server-side (the page is rendered on the server so crawlers and store reviewers get plain HTML). */
export async function fetchLegalPage(doc: LegalDoc, locale: string): Promise<LegalPage | null> {
  try {
    const res = await fetch(`${API_URL}/public/legal/${doc}`, {
      headers: { "Accept-Language": locale },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return ((await res.json()) as DataResponse<LegalPage>).data;
  } catch {
    return null;
  }
}

export async function deleteAccountFromWeb(email: string, password: string): Promise<void> {
  await api.post<void>("/app/auth/delete-account", { email, password }, { public: true });
}
