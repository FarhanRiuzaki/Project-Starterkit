import { Elysia } from "elysia";
import { config } from "../config";
import { safeEqual } from "../crypto";
import { ApiError } from "../errors";

/** Every `/v1` request (a route or not) needs `X-Internal-Token` equal to INTERNAL_API_TOKEN, compared constant-time; else 401. */
export const internalAuth = new Elysia({ name: "kernel.internal-auth" }).onRequest(({ request }) => {
  const path = new URL(request.url).pathname;
  if ((path === "/v1" || path.startsWith("/v1/")) && !safeEqual(request.headers.get("x-internal-token") ?? "", config().INTERNAL_API_TOKEN)) {
    throw new ApiError("unauthenticated");
  }
});
