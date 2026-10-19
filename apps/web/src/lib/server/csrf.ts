import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";

/** Mutation header: the token lives in the sealed session cookie; the server hands it to the layout. */
export const CSRF_HEADER = "x-csrf-token";

export function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time string compare (false for different lengths). */
export function secureEquals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function csrfOk(sent: string | null, expected: string | undefined): boolean {
  return !!sent && !!expected && secureEquals(sent, expected);
}
