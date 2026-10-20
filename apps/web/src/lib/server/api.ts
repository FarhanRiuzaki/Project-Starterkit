import "server-only";
import { $ZodError } from "zod/v4/core";
import { type ErrorCode, ERROR_STATUS } from "@starterkit/shared/contracts/common";
import type { PermissionName } from "@starterkit/shared/permissions";
import { CSRF_HEADER, csrfOk } from "./csrf";
import { log } from "./logger";
import { type AuthCtx, authOf, getSession } from "./session";

export type { AuthCtx };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(status: number, code: ErrorCode, message: string): Response {
  return json({ error: { code, message } }, status);
}

/** 400 for a request value outside the contract (the zod schemas in lib/shared/contracts). */
export const badRequest = () => apiError(400, "bad_request", "A request parameter has an unsupported value.");

/** 404 for a record that doesn't exist; `noun` names it in the message ("user", "role"). */
export const notFound = (noun: string) => apiError(404, "not_found", `This ${noun} doesn't exist or was deleted.`);

const PROTECTED: Partial<Record<ErrorCode, string>> = {
  self_action: "You can't do this to your own account. Ask another administrator.",
  last_superadmin: "This is the last active Superadmin. Make another user Superadmin first.",
  ldap_password: "This account signs in with a directory password. Change it in your directory.",
  superadmin_locked: "The Superadmin role holds every permission and can't be changed or deleted.",
  role_in_use: "Users still have this role. Remove it from them first, then delete the role.",
};
/** The error response for a protection-rule code from rules.ts. */
export const blocked = (code: ErrorCode) => apiError(ERROR_STATUS[code], code, PROTECTED[code] ?? "This change isn't allowed.");

/** 409 for ending the session that makes the request (the user signs out instead); both end-session routes send it. */
export const currentSession = () => apiError(409, "self_action", "This is the session you're using. Sign out instead.");

/** Validation error → 400; anything else → a fixed 500 message, detail to the log only. */
export function handleError(e: unknown): Response {
  if (e instanceof $ZodError) return badRequest();
  log.error({ err: e instanceof Error ? { name: e.name, message: e.message } : String(e) }, "api error");
  return apiError(ERROR_STATUS.internal, "internal", "The server hit an unexpected error. Try again; if it continues, contact your administrator.");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The API route guard. In order: a live session (authOf: else 401, cookie cleared) → on a mutation, the session's CSRF token
 * in `x-csrf-token` (else 403 csrf) → `perm` among the user's current permissions (else 403 forbidden; the handler
 * never runs, so nothing is read) → handler; errors map through handleError. `perm: null` = signed in is enough.
 */
export async function withPermission(
  req: Request, perm: PermissionName | null, handler: (ctx: AuthCtx) => Promise<Response>,
): Promise<Response> {
  const s = await getSession();
  const ctx = authOf(s);
  if (!ctx) {
    if (s.sid) s.destroy(); // a stale sid; a cookie waiting for its second factor is left alone
    return apiError(401, "unauthenticated", "Sign in to continue.");
  }
  if (!SAFE_METHODS.has(req.method) && !csrfOk(req.headers.get(CSRF_HEADER), s.csrf)) {
    return apiError(403, "csrf", "The security token is missing or expired. Reload the page and try again.");
  }
  if (perm && !ctx.perms.has(perm)) return apiError(403, "forbidden", "Your role doesn't allow this. Ask an administrator for access.");
  try {
    return await handler(ctx);
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Client address for rate limits and logs. X-Forwarded-For is client-controlled and ignored by default (one shared
 * "unknown" bucket). TRUSTED_PROXY=true (a proxy in front appends XFF): the right-most entry, the address it saw.
 */
// ponytail: no socket address reaches a route handler without a custom server; add a server that stamps the TCP peer if per-IP limits must work without a proxy.
export function clientIp(req: Request, trustedProxy = process.env.TRUSTED_PROXY === "true"): string {
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

/** 429 with Retry-After (seconds). */
export function tooManyAttempts(sec: number, text: string): Response {
  const res = apiError(429, "rate_limited", text);
  res.headers.set("Retry-After", String(sec));
  return res;
}
