import { Elysia } from "elysia";
import { ApiError } from "../errors";
import { BODY_MAX } from "../parse";

/**
 * Request bodies over 64 KB are 400 bad_request. A declared Content-Length is checked when the request arrives (before
 * the token); a body without one is counted while `body()` reads it in the handler, after the guard. Elysia never
 * parses a body (onParse answers null), so a malformed body is the handler's 400, never earlier.
 */
export const bodyLimit = new Elysia({ name: "kernel.body-limit" })
  .onRequest(({ request }) => {
    if (Number(request.headers.get("content-length") ?? 0) > BODY_MAX) throw new ApiError("bad_request");
  })
  .onParse({ as: "global" }, () => null);
