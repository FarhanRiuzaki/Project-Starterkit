import { Elysia } from "elysia";
import { config } from "../config";
import { safeEqual } from "../crypto";
import { ApiError } from "../errors";

/** The only requests answered without the token: health checks for the load balancer. */
const OPEN = new Set(["GET /healthz", "GET /readyz"]);

/** `pathname` decoded and normalized (`%76` → `v`, `//` and `.`/`..` collapsed); null when it doesn't decode. */
function decodedPath(pathname: string): string | null {
  try {
    return new URL(decodeURIComponent(pathname).replace(/\/+/g, "/"), "http://x").pathname;
  } catch {
    return null;
  }
}

/**
 * Every request (a route or not) needs `X-Internal-Token` equal to INTERNAL_API_TOKEN, compared constant-time, except
 * the exact OPEN list compared on the decoded path; else 401. Checked before routing, so a missing token never learns
 * which paths exist, and no encoding of a path can skip it.
 */
export const internalAuth = new Elysia({ name: "kernel.internal-auth" }).onRequest(({ request }) => {
  if (OPEN.has(`${request.method} ${decodedPath(new URL(request.url).pathname)}`)) return;
  if (!safeEqual(request.headers.get("x-internal-token") ?? "", config().INTERNAL_API_TOKEN)) throw new ApiError("unauthenticated");
});
