import { Elysia } from "elysia";
import { config } from "../config";
import { safeEqual } from "../crypto";
import { ApiError } from "../errors";

/** The only requests answered without the token: GET of these exact raw paths (health checks for the load balancer). */
const OPEN = new Set(["/healthz", "/readyz"]);

/**
 * Every request (a route or not) needs `X-Internal-Token` equal to INTERNAL_API_TOKEN, compared constant-time, before
 * routing; else 401. The one exception is a GET whose raw path (never decoded or normalized) is exactly an OPEN entry,
 * so any other spelling of a path, encoded or with dot segments, needs the token too.
 */
export const internalAuth = new Elysia({ name: "kernel.internal-auth" }).onRequest(({ request }) => {
  if (request.method === "GET" && OPEN.has(new URL(request.url).pathname)) return;
  if (!safeEqual(request.headers.get("x-internal-token") ?? "", config().INTERNAL_API_TOKEN)) throw new ApiError("unauthenticated");
});
