import "server-only";
import { randomUUID } from "node:crypto";
import { apiError, clientIp } from "./api";
import { config } from "./config";
import { log } from "./logger";

/** The fixed 500 message (the API sends the same one for its own failures). */
export const INTERNAL_COPY = "The server hit an unexpected error. Try again; if it continues, contact your administrator.";

export type BackendInit = {
  method?: string; body?: BodyInit | null; contentType?: string; token?: string | null; challenge?: string | null;
  /** The browser's request (or a server component's headers): client IP and user agent for the API. */
  req?: { headers: Headers };
};

/** No answer at all (refused, reset): safe to send a GET again. A timeout is a DOMException and is not retried. */
const connectionError = (e: unknown) => e instanceof TypeError;

/**
 * One call to the API (`API_BASE_URL` + `path`, e.g. "/v1/users?page=2"): `X-Internal-Token`, the session bearer and
 * the 2FA challenge when given, the client's IP and user agent, a new `X-Request-Id`; 10 s in all. A GET is sent once
 * more on a connection error; a mutation never. No answer → the fixed 500 `internal`, the cause in the error log.
 */
export async function backend(path: string, init: BackendInit = {}): Promise<Response> {
  const c = config();
  const method = init.method ?? "GET";
  const requestId = randomUUID();
  const headers = new Headers({
    "X-Internal-Token": c.INTERNAL_API_TOKEN,
    "X-Client-Ip": init.req ? clientIp(init.req) : "unknown",
    "X-Client-Ua": init.req?.headers.get("user-agent") ?? "",
    "X-Request-Id": requestId,
  });
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.challenge) headers.set("X-Auth-Challenge", init.challenge);
  if (init.contentType) headers.set("Content-Type", init.contentType);
  // ponytail: the 10 s also covers streaming the answer body, so a CSV export slower than that is cut off; give CSV a separate, longer timeout if exports grow.
  const signal = AbortSignal.timeout(10_000);
  const send = () => fetch(c.API_BASE_URL + path, { method, headers, body: init.body ?? null, signal, cache: "no-store", redirect: "manual" });
  try {
    try {
      return await send();
    } catch (e) {
      if (method !== "GET" || !connectionError(e)) throw e;
      return await send();
    }
  } catch (e) {
    const err = e instanceof Error ? { name: e.name, message: e.message, code: (e.cause as { code?: string } | undefined)?.code } : { name: typeof e };
    log.error({ err, method, path: path.split("?")[0], requestId }, "api unreachable");
    return apiError(500, "internal", INTERNAL_COPY);
  }
}

/** `backend` for a JSON read: the status, and the parsed body of a 2xx answer (else null). */
export async function backendJson<T>(path: string, init: BackendInit = {}): Promise<{ status: number; data: T | null }> {
  const r = await backend(path, init);
  if (!r.ok) {
    await r.body?.cancel();
    return { status: r.status, data: null };
  }
  return { status: r.status, data: (await r.json()) as T };
}

/**
 * The API path for a browser `/api/...` URL (path and query): the decoded path must be `/api/` + `[a-z0-9/_-]` (so no
 * dot segment, encoded or not) and outside `/api/auth/` (those routes set the cookie themselves). Else null.
 */
export function v1Path(url: string): string | null {
  const u = new URL(url, "http://local");
  let p: string;
  try {
    p = decodeURIComponent(u.pathname);
  } catch {
    return null;
  }
  if (!/^\/api\/[a-z0-9/_-]+$/.test(p) || p.includes("//") || p.startsWith("/api/auth/")) return null;
  return `/v1/${p.slice("/api/".length)}${u.search}`;
}

/** Headers of an API answer the browser gets; everything else (cookies, server details) stays behind. */
const PASSED = ["content-type", "content-disposition", "retry-after", "cache-control"];

/** The API's answer as the browser gets it: same status, body streamed through, only the PASSED headers. */
export function relay(res: Response): Response {
  const headers = new Headers();
  for (const h of PASSED) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers });
}
