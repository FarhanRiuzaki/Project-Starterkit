import { sealData, unsealData } from "iron-session";
import { vi } from "vitest";
import { type AppSession, SESSION_COOKIE } from "@/lib/server/session";

/** CSRF token and API session token the helper seals into the cookie; send the first as `x-csrf-token` on mutations. */
export const TEST_CSRF = "c".repeat(43);
export const TEST_TOKEN = "session-token-of-the-test";

/**
 * Seals `data` (default: a full session) as the `sk_session` cookie into `jar`, the Map behind the test file's
 * `vi.mock("next/headers")` cookie store. `process.env.SESSION_SECRET` must be set (vi.hoisted) first.
 */
export async function sealCookie(jar: Map<string, string>, data: AppSession = { token: TEST_TOKEN, csrf: TEST_CSRF }): Promise<void> {
  jar.set(SESSION_COOKIE, await sealData(data, { password: process.env.SESSION_SECRET!, ttl: 3600 }));
}

/** The session cookie in `jar`, unsealed; null when there is none. */
export async function cookieOf(jar: Map<string, string>): Promise<AppSession | null> {
  const v = jar.get(SESSION_COOKIE);
  return v ? unsealData<AppSession>(v, { password: process.env.SESSION_SECRET! }) : null;
}

/**
 * A fake API in place of the global `fetch`: `answer` gets each request the web sends (URL under API_BASE_URL) and
 * returns the answer. Returns the list of requests seen so far (clones, bodies readable).
 */
export function fakeApi(answer: (req: Request) => Response | Promise<Response>): Request[] {
  const seen: Request[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(req.clone());
    return answer(req);
  }));
  return seen;
}

/** The pathname + search of a request the fake API saw ("/v1/users?page=2"). */
export const pathOf = (r: Request) => { const u = new URL(r.url); return u.pathname + u.search; };
