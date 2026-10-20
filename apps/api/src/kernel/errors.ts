import { DrizzleQueryError } from "drizzle-orm";
import { $ZodError } from "zod/v4/core";
import { type ErrorCode, ERROR_STATUS } from "@starterkit/shared/contracts/common";
import { maskText } from "@starterkit/shared/log-redact";
import { log } from "./log";

const INTERNAL = "The server hit an unexpected error. Try again; if it continues, contact your administrator.";

/** Fixed copy per code; a route passes its own text where it has one. */
const COPY: Partial<Record<ErrorCode, string>> = {
  unauthenticated: "Sign in to continue.",
  forbidden: "Your role doesn't allow this. Ask an administrator for access.",
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

/**
 * An error answer: status from ERROR_STATUS (unless given: `invalid_credentials` is 400 for a signed-in user's wrong
 * current password), message from the fixed copy unless given.
 */
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message?: string, readonly headers?: Record<string, string>, readonly status: number = ERROR_STATUS[code]) {
    super(message ?? COPY[code] ?? "This change isn't allowed.");
    this.name = "ApiError";
  }
}

export const errorBody = (code: ErrorCode, message: string) => ({ error: { code, message } });

/** 404 for a record that doesn't exist; `noun` names it in the message ("user", "role"). */
export const notFound = (noun: string) => new ApiError("not_found", `This ${noun} doesn't exist or was deleted.`);

/** 409 for ending the session that makes the request (the user signs out instead). */
export const currentSession = () => new ApiError("self_action", "This is the session you're using. Sign out instead.");

/** 429 with Retry-After (seconds). */
export const tooManyAttempts = (sec: number, text: string) => new ApiError("rate_limited", text, { "Retry-After": String(sec) });

/**
 * What a log line may say about a thrown value: name and masked message (a non-Error only by its type). A failed
 * Drizzle query is described by the driver's error: its own message holds the SQL and every parameter (hashes, emails).
 * A PostgreSQL error adds its SQLSTATE (`code`), constraint and table when present; never `detail` or `hint`, which
 * quote row values.
 */
export function errorDetail(err: unknown): Record<string, string | undefined> {
  const e = err instanceof DrizzleQueryError && err.cause ? err.cause : err;
  const pg = (e ?? {}) as { errno?: unknown; constraint?: unknown; table?: unknown };
  const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return e instanceof Error
    ? { name: e.name, message: maskText(e.message), code: text(pg.errno), constraint: text(pg.constraint), table: text(pg.table) }
    : { name: typeof e };
}

/** An unexpected error: logged through `errorDetail` and the fixed 500. */
export function unexpected(err: unknown, requestId?: string): Response {
  log.error({ err: errorDetail(err), requestId }, "api error");
  return Response.json(errorBody("internal", INTERNAL), { status: 500, headers: { "Cache-Control": "no-store" } });
}

/** The answer to a thrown value: a zod error → 400, ApiError → itself, anything else → `unexpected`. Always no-store. */
export function errorResponse(err: unknown, requestId?: string): Response {
  if (!(err instanceof ApiError) && !(err instanceof $ZodError)) return unexpected(err, requestId);
  const e = err instanceof ApiError ? err : new ApiError("bad_request");
  return Response.json(errorBody(e.code, e.message), { status: e.status, headers: { ...e.headers, "Cache-Control": "no-store" } });
}
