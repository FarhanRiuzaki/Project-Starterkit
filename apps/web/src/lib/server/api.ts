import "server-only";
import type { ErrorCode } from "@starterkit/shared/contracts/common";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(status: number, code: ErrorCode, message: string): Response {
  return json({ error: { code, message } }, status);
}

/**
 * Client address the API sees (`X-Client-Ip`: rate limits, sign-in log, session list). X-Forwarded-For is
 * client-controlled and ignored by default (one shared "unknown" bucket). TRUSTED_PROXY=true (a proxy in front appends
 * XFF): the right-most entry, the address it saw.
 */
// ponytail: no socket address reaches a route handler without a custom server; add a server that stamps the TCP peer if per-IP limits must work without a proxy.
export function clientIp(req: { headers: Headers }, trustedProxy = process.env.TRUSTED_PROXY === "true"): string {
  if (trustedProxy) {
    const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1]!;
  }
  return "unknown";
}

/**
 * The request comes from this app's own pages: `Sec-Fetch-Site` is same-origin / none (typed URL), or the `Origin`
 * header equals the request's origin. Guards the cookie-setting /api/auth POSTs against cross-site forms (login CSRF).
 * Behind a proxy that rewrites Host (TRUSTED_PROXY=true), the public origin is `X-Forwarded-Proto`://`X-Forwarded-Host`
 * (first entry each); without TRUSTED_PROXY those headers are client-controlled and ignored.
 */
export function sameOrigin(req: Request, trustedProxy = process.env.TRUSTED_PROXY === "true"): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;
  const url = new URL(req.url);
  const first = (h: string) => req.headers.get(h)?.split(",")[0]?.trim() || null;
  const host = trustedProxy ? first("x-forwarded-host") : null;
  const origin = host ? `${first("x-forwarded-proto") ?? url.protocol.slice(0, -1)}://${host}` : url.origin;
  return req.headers.get("origin") === origin;
}

export const crossSite = () => apiError(403, "forbidden", "The request didn't come from this app. Reload the page and try again.");

/** 403 csrf: a mutation with a full session whose `x-csrf-token` is missing or wrong. */
export const csrfFailed = () => apiError(403, "csrf", "The security token is missing or expired. Reload the page and try again.");
