import { Elysia } from "elysia";
import { ApiError } from "../errors";

const MAX = 64 * 1024;

/** The body as text, read up to MAX bytes; more is 400 bad_request. */
async function readText(r: Request): Promise<string> {
  if (!r.body) return "";
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  for (let size = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX) {
      await reader.cancel();
      throw new ApiError("bad_request");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Request bodies over 64 KB are 400 bad_request: a declared Content-Length when the request arrives, else while reading.
 * Every route gets its body as raw text (never parsed here), so a malformed body answers 400 from the handler's
 * `body()`, after the guard; a mounted app (wildcard route) reads its own body.
 */
export const bodyLimit = new Elysia({ name: "kernel.body-limit" })
  .onRequest(({ request }) => {
    if (Number(request.headers.get("content-length") ?? 0) > MAX) throw new ApiError("bad_request");
  })
  .onParse({ as: "global" }, ({ request, route }) => (route.endsWith("/*") ? null : readText(request)));
