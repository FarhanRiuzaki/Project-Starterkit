import "server-only";
import { $ZodError } from "zod/v4/core";
import type { ErrorCode } from "@/lib/shared/contracts/common";
import type { PermissionName } from "@/lib/shared/permissions";
import { CSRF_HEADER, csrfOk } from "./csrf";
import { log } from "./logger";
import { type AuthCtx, authOf, getSession } from "./session";

export type { AuthCtx };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** `internal` is the generic 500 of handleError; every other code is in the shared contract. */
export function apiError(status: number, code: ErrorCode | "internal", message: string): Response {
  return json({ error: { code, message } }, status);
}

/** Validation error → 400; anything else → a fixed 500 message, detail to the log only. */
export function handleError(e: unknown): Response {
  if (e instanceof $ZodError) return apiError(400, "bad_request", "A request parameter has an unsupported value.");
  log.error({ err: e instanceof Error ? { name: e.name, message: e.message } : String(e) }, "api error");
  return apiError(500, "internal", "The server hit an unexpected error. Try again; if it continues, contact your administrator.");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The API route guard. In order: a live session (else 401, cookie cleared) → on a mutation, the session's CSRF token
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

/** 429 with Retry-After (seconds). */
export function tooManyAttempts(sec: number, text: string): Response {
  const res = apiError(429, "rate_limited", text);
  res.headers.set("Retry-After", String(sec));
  return res;
}
