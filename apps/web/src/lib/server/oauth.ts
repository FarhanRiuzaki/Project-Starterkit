import "server-only";
import { headers } from "next/headers";
import { ConnectionProvider } from "@starterkit/shared/contracts/me";
import { backendJson } from "./backend";
import { type Config, config } from "./config";

/**
 * Binds a provider round trip to the browser that started it: `<mode>.<random binding>`; the API stores only the
 * binding's hash with the state, so a callback in another browser (login CSRF) fails.
 */
export const OAUTH_COOKIE = "sk_oauth";

export const isProvider = (p: string): p is ConnectionProvider => ConnectionProvider.safeParse(p).success;

/**
 * 10 minutes (the state's lifetime), only under /api/auth/oauth. Over HTTPS `SameSite=None; Secure`: Apple posts its
 * answer from its own site (form_post). Over plain HTTP (dev, E2E) `Lax`, enough for the GET callbacks.
 */
export const oauthCookieOptions = (c: Config = config()) =>
  ({ httpOnly: true, path: "/api/auth/oauth", maxAge: 600, secure: c.COOKIE_SECURE, sameSite: c.COOKIE_SECURE ? "none" : "lax" }) as const;

/** 303 to `url`, not cached. */
export const seeOther = (url: string) => new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");

/**
 * A page that moves on to `url` (an internal path) with `<meta http-equiv="refresh">`, plus a plain link. The provider
 * sent the browser here from its own site, so the `SameSite=Strict` session cookie isn't sent yet; the refresh is a new
 * navigation from this origin, which sends it. No script.
 */
export function landingPage(url: string): Response {
  const u = attr(url);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${u}"><title>Signing in</title></head>`
    + `<body><p><a href="${u}">Continue</a></p></body></html>`;
  // CSP: proxy.ts sets the app's policy on every response (it replaces any the route sets); with no nonce here, no script runs.
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Which providers can sign in (`GET /v1/auth/providers`); none when the API doesn't say. */
export async function oauthProviders(): Promise<Record<ConnectionProvider, boolean>> {
  const { data } = await backendJson<Record<ConnectionProvider, boolean>>("/v1/auth/providers", { req: { headers: await headers() } });
  return data ?? { google: false, apple: false };
}
