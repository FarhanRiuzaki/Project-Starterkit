// Transitional: request parsing for the Hono routes until Task 18; Elysia handlers use kernel/parse.ts.
import type { Context } from "hono";
import type { ZodType } from "zod";
import { ApiError, notFound } from "../kernel/errors";
import { isUuid } from "../kernel/parse";

export { isUuid } from "../kernel/parse";

/** The query string through `schema` (first value per key); a miss throws the ZodError that answers 400. */
export function query<T>(c: Context, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(Object.entries(c.req.queries()).map(([k, v]) => [k, v[0]])));
}

/** The JSON body through `schema`: another content type, malformed JSON or a schema miss is 400 `bad_request`. */
export async function body<T>(c: Context, schema: ZodType<T>): Promise<T> {
  if (!/^application\/json\s*(;|$)/i.test(c.req.header("content-type") ?? "")) throw new ApiError("bad_request");
  const data: unknown = await c.req.json().catch(() => {
    throw new ApiError("bad_request");
  });
  return schema.parse(data);
}

/** Path parameter `name` as a UUID; anything else is 404 `not_found` for `noun` (never a failed uuid cast). */
export function idParam(c: Context, name: string, noun: string): string {
  const id = c.req.param(name);
  if (!id || !isUuid(id)) throw notFound(noun);
  return id;
}
