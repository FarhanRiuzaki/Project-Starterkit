import type { ZodType } from "zod";
import { ApiError, notFound } from "./errors";

/**
 * The JSON body through `schema`, in the handler (after the guard): the body plugin hands every route its raw text,
 * so another content type, malformed JSON or a schema miss is 400 `bad_request` here, never before a 401/403.
 */
export function body<T>(c: { body: unknown; request: Request }, schema: ZodType<T>): T {
  if (!/^application\/json\s*(;|$)/i.test(c.request.headers.get("content-type") ?? "")) throw new ApiError("bad_request");
  let data: unknown;
  try {
    data = JSON.parse(typeof c.body === "string" ? c.body : "");
  } catch {
    throw new ApiError("bad_request");
  }
  return schema.parse(data);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `s` is a UUID (safe to compare with a uuid column). */
export const isUuid = (s: string): boolean => UUID.test(s);

/** A path parameter as a UUID; anything else is 404 `not_found` for `noun` (never a failed uuid cast). */
export function idParam(id: string | undefined, noun: string): string {
  if (!id || !isUuid(id)) throw notFound(noun);
  return id;
}

/** The query string with the first value of each key (the contract's rule; Elysia would make an array of a repeat). */
export function firstValues(url: string): Record<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of new URL(url).searchParams) if (!out.has(k)) out.set(k, v);
  return Object.fromEntries(out); // own keys even for "__proto__"
}
