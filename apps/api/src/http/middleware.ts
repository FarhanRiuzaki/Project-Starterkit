import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import { routePath } from "hono/route";
import { config } from "../config";
import { log } from "../log";
import { ApiError } from "./errors";

/** Per-request values every handler can read (`c.var`). `client` is trusted only behind `internalAuth`. */
export type AppEnv = { Variables: { requestId: string; client: { ip: string; ua: string } } };

const sha256 = (s: string) => createHash("sha256").update(s).digest();

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
  await next();
  c.header("Cache-Control", "no-store");
  const ms = Math.round(performance.now() - start);
  log.info({ method: c.req.method, route: routePath(c, -1), status: c.res.status, ms, requestId }, "request");
};

/** `X-Internal-Token` must equal INTERNAL_API_TOKEN (compared as SHA-256 digests, constant time); else 401. */
export const internalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const given = sha256(c.req.header("x-internal-token") ?? "");
  if (!timingSafeEqual(given, sha256(config().INTERNAL_API_TOKEN))) throw new ApiError("unauthenticated");
  await next();
};

/** Request bodies over 64 KB are 400 bad_request. */
export const bodyLimit = honoBodyLimit({
  maxSize: 64 * 1024,
  onError: () => {
    throw new ApiError("bad_request");
  },
});
