// Transitional: the Hono middleware of the routers mounted inside the Elysia app until Task 18. Internal auth and the
// early Content-Length check run in the Elysia plugins before a request reaches Hono.
import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import { routePath } from "hono/route";
import { ApiError, errorResponse } from "../kernel/errors";
import { log } from "../kernel/log";

/** Per-request values every handler can read (`c.var`). `client` is trusted only behind internal auth. */
export type AppEnv = { Variables: { requestId: string; client: { ip: string; ua: string } } };

/** Hono onError: the kernel's mapping (validation → 400, ApiError → itself, anything else → the fixed 500). */
export const onError = (err: unknown, c: Context): Response => errorResponse(err, c.get("requestId"));

/**
 * Request id (`X-Request-Id` from Next, else a new UUIDv7), client ip/ua from `X-Client-Ip`/`X-Client-Ua`, then one
 * access log line (method, route pattern, status, ms; never the query) and `Cache-Control: no-store` on every answer.
 */
export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = performance.now();
  const given = c.req.header("x-request-id");
  const requestId = given && /^[\w-]{1,64}$/.test(given) ? given : Bun.randomUUIDv7();
  c.set("requestId", requestId);
  c.set("client", { ip: c.req.header("x-client-ip") || "unknown", ua: c.req.header("x-client-ua") ?? "" });
  try {
    await next();
  } catch (e) {
    c.res = onError(e, c); // Hono hands only Error instances to app.onError; a thrown string or object lands here
  }
  c.header("Cache-Control", "no-store");
  const ms = Math.round(performance.now() - start);
  log.info({ method: c.req.method, route: routePath(c, -1), status: c.res.status, ms, requestId }, "request");
};

/** Request bodies over 64 KB are 400 bad_request (a body without Content-Length is counted while read). */
export const bodyLimit = honoBodyLimit({
  maxSize: 64 * 1024,
  onError: () => {
    throw new ApiError("bad_request");
  },
});
