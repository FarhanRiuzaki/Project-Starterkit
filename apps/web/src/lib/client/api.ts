import { signInHref } from "@starterkit/ui/lib/safe-path";
import type { ApiErrorBody } from "@/lib/shared/contracts/common";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** The record asked for doesn't exist (404): final, so detail screens don't retry it and show their not-found state. */
export const isNotFound = (e: unknown): boolean => e instanceof ApiError && e.status === 404;
/** React Query `retry` for a detail query: once for anything but a 404. */
export const retryUnlessNotFound = (failures: number, e: Error): boolean => !isNotFound(e) && failures < 1;

/** The server's message for an API error (it is written as UI copy, 429 included); a fixed line when unreachable. */
export function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : "The server can't be reached. Check your connection, then try again.";
}

let csrfToken: string | null = null;

/** The signed-in layout hands the session's CSRF token here; every mutation then sends it as `x-csrf-token`. */
export function setCsrf(token: string | null): void {
  csrfToken = token;
}

/** Sign-in steps explain their own 401 (wrong credentials, expired step): no automatic redirect. */
const OWN_401 = /^\/api\/auth(\/|\?|$)/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The browser talks only to same-origin `/api/*` (never the backend): anything else throws before a request is made. */
export function assertApiPath(path: string): void {
  if (!path.startsWith("/api/") || path.startsWith("//")) throw new Error(`api(): "${path.slice(0, 40)}" must start with /api/`);
}

/** Call the app's API. 401 outside /api/auth → the sign-in page, returning here afterwards. Errors throw ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertApiPath(path);
  const method = (init.method ?? "GET").toUpperCase();
  // Headers in any form the Fetch API takes (object, tuple list, Headers instance); the caller's own values win.
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrfToken && !SAFE_METHODS.has(method) && !headers.has("x-csrf-token")) headers.set("x-csrf-token", csrfToken);
  const res = await fetch(path, { ...init, credentials: "same-origin", headers });
  if (!res.ok) throw await failure(res, path);
  return (await res.json().catch(() => ({}))) as T;
}

/** The ApiError for a failed answer; a 401 outside /api/auth first sends the browser to sign-in (returning here). */
async function failure(res: Response, path: string): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
  if (res.status === 401 && !OWN_401.test(path) && typeof window !== "undefined") {
    window.location.assign(signInHref(window.location.pathname + window.location.search));
  }
  return new ApiError(res.status, body.error?.code ?? "error", body.error?.message ?? `HTTP ${res.status}`);
}

/**
 * Save a file answer of the app's API (CSV export) under the server's `Content-Disposition` filename, else
 * `fallbackName`; resolves to the saved name. Same rules as `api()`: same-origin `/api/*` only, 401 → sign-in, errors
 * throw ApiError.
 */
export async function download(path: string, fallbackName: string): Promise<string> {
  assertApiPath(path);
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw await failure(res, path);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url)); // after the click's download has taken the blob
  return name;
}
