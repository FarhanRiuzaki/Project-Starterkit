import { Elysia } from "elysia";
import { ApiError, errorResponse } from "../errors";
import { requestMeta } from "./context";

/**
 * Every failure as the contract's error body, no-store: a query that fails its schema (or an unparsable request) is 400
 * `bad_request`, an unknown path 404 `not_found`, an ApiError itself, a ZodError 400, anything else the fixed 500
 * (logged masked, never its text in the body).
 */
export const errorHandler = new Elysia({ name: "kernel.error" }).onError({ as: "global" }, ({ code, error, request }) => {
  const mapped = code === "VALIDATION" || code === "PARSE" ? new ApiError("bad_request") : code === "NOT_FOUND" ? new ApiError("not_found") : error;
  const meta = requestMeta(request);
  const res = errorResponse(mapped, meta?.requestId);
  if (meta) meta.status = res.status;
  return res;
});
