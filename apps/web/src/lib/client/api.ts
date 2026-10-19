import { signInHref } from "@starterkit/ui/lib/safe-path";
import type { ApiErrorBody } from "@/lib/shared/contracts/common";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | null = null;

/** The signed-in layout hands the session's CSRF token here; every mutation then sends it as `x-csrf-token`. */
export function setCsrf(token: string | null): void {
  csrfToken = token;
}

/** Sign-in steps explain their own 401 (wrong credentials, expired step): no automatic redirect. */
const OWN_401 = /^\/api\/auth(\/|\?|$)/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Call the app's API. 401 outside /api/auth → the sign-in page, returning here afterwards. Errors throw ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && !SAFE_METHODS.has(method) ? { "x-csrf-token": csrfToken } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & Partial<ApiErrorBody>;
  if (!res.ok) {
    if (res.status === 401 && !OWN_401.test(path) && typeof window !== "undefined") {
      window.location.assign(signInHref(window.location.pathname + window.location.search));
    }
    throw new ApiError(res.status, body.error?.code ?? "error", body.error?.message ?? `HTTP ${res.status}`);
  }
  return body;
}
