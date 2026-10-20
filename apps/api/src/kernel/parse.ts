import type { ZodType } from "zod";
import { ApiError, notFound } from "./errors";

/** The largest request body accepted (64 KB). */
export const BODY_MAX = 64 * 1024;

/** The body as text, read up to BODY_MAX bytes; more is 400 bad_request. */
async function readText(r: Request): Promise<string> {
  if (!r.body) return "";
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  for (let size = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_MAX) {
      await reader.cancel();
      throw new ApiError("bad_request");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The JSON body through `schema`, read in the handler (after the guard; the body plugin leaves it unread): another
 * content type, a body over 64 KB, malformed JSON or a schema miss is 400 `bad_request` here, never before a 401/403.
 */
export async function body<T>(c: { request: Request }, schema: ZodType<T>): Promise<T> {
  if (!/^application\/json\s*(;|$)/i.test(c.request.headers.get("content-type") ?? "")) throw new ApiError("bad_request");
  const text = await readText(c.request);
  let data: unknown;
  try {
    data = JSON.parse(text);
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
