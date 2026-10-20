import { type NextRequest, NextResponse } from "next/server";
import { securityHeaders } from "./security-headers";

/**
 * CSP with a per-request nonce plus the security headers, on every matched request (Next 16: proxy = middleware;
 * Node runtime). No permission checks here: layouts (requirePagePermission) and the API (behind app/api) do that.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const sec = securityHeaders({ nonce, secure: process.env.COOKIE_SECURE === "true" });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", sec["Content-Security-Policy"]!);
  // Requested page for the sign-in deep link (?next=); page-guard validates it with signInHref. nextUrl is a WHATWG
  // URL, so dot segments (also %2e%2e) are already resolved. Drop the client router's _rsc cache-buster.
  const search = new URLSearchParams(request.nextUrl.search);
  search.delete("_rsc");
  const qs = search.toString();
  headers.set("x-pathname", request.nextUrl.pathname + (qs ? `?${qs}` : ""));
  const res = NextResponse.next({ request: { headers } });
  for (const [k, v] of Object.entries(sec)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
