import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { $ZodError } from "zod/v4/core";
import { type ErrorCode, ERROR_STATUS } from "@starterkit/shared/contracts/common";
import { maskText } from "@starterkit/shared/log-redact";
import { log } from "../log";

const INTERNAL = "The server hit an unexpected error. Try again; if it continues, contact your administrator.";

/** Fixed copy per code (ported from apps/web/src/lib/server/api.ts); a route passes its own text where it has one. */
const COPY: Partial<Record<ErrorCode, string>> = {
  unauthenticated: "Sign in to continue.",
  forbidden: "Your role doesn't allow this. Ask an administrator for access.",
  csrf: "The security token is missing or expired. Reload the page and try again.",
  not_found: "This page doesn't exist or was deleted.",
  bad_request: "A request parameter has an unsupported value.",
  account_inactive: "This account is inactive. Ask an administrator to reactivate it.",
  internal: INTERNAL,
  // protection rules (PROTECTED in the web)
  self_action: "You can't do this to your own account. Ask another administrator.",
  last_superadmin: "This is the last active Superadmin. Make another user Superadmin first.",
  ldap_password: "This account signs in with a directory password. Change it in your directory.",
  superadmin_locked: "The Superadmin role holds every permission and can't be changed or deleted.",
  role_in_use: "Users still have this role. Remove it from them first, then delete the role.",
};

/** An error answer: status from ERROR_STATUS, message from the fixed copy unless given. */
export class ApiError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message?: string, readonly headers?: Record<string, string>) {
    super(message ?? COPY[code] ?? "This change isn't allowed.");
    this.name = "ApiError";
    this.status = ERROR_STATUS[code];
  }
}

export const errorBody = (code: ErrorCode, message: string) => ({ error: { code, message } });

/** 404 for a record that doesn't exist; `noun` names it in the message ("user", "role"). */
export const notFound = (noun: string) => new ApiError("not_found", `This ${noun} doesn't exist or was deleted.`);

/** 409 for ending the session that makes the request (the user signs out instead). */
export const currentSession = () => new ApiError("self_action", "This is the session you're using. Sign out instead.");

export const crossSite = () => new ApiError("forbidden", "The request didn't come from this app. Reload the page and try again.");

/** 429 with Retry-After (seconds). */
export const tooManyAttempts = (sec: number, text: string) => new ApiError("rate_limited", text, { "Retry-After": String(sec) });

/** Hono onError: validation → 400, ApiError → itself, anything else → logged (name, masked message) and a fixed 500. */
export function onError(err: unknown, c: Context): Response {
  let e: ApiError;
  if (err instanceof ApiError) e = err;
  else if (err instanceof $ZodError) e = new ApiError("bad_request");
  else {
    const detail = err instanceof Error ? { name: err.name, message: maskText(err.message) } : { name: typeof err };
    log.error({ err: detail, requestId: c.get("requestId") }, "api error");
    e = new ApiError("internal");
  }
  return c.json(errorBody(e.code, e.message), e.status as ContentfulStatusCode, { ...e.headers, "Cache-Control": "no-store" });
}
