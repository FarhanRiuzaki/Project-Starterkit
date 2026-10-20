import { Elysia } from "elysia";
import { log } from "../log";
import { firstValues } from "../parse";

/** The caller as Next reports it (`X-Client-Ip`/`X-Client-Ua`); trusted only behind internal-auth. */
export type Client = { ip: string; ua: string };
type Meta = { requestId: string; client: Client; start: number; status?: number };

const metas = new WeakMap<Request, Meta>();

/** The request's id and client, set when it arrives (also for a request that matches no route or fails early). */
export const requestMeta = (r: Request): Meta | undefined => metas.get(r);

/**
 * Request id (`X-Request-Id` from Next, else a new UUIDv7) and client ip/ua from the `X-Client-*` headers on every
 * request; the query string as the first value per key (before validation); then one access log line (method, route
 * pattern, status, ms; never the query) and `Cache-Control: no-store` on every answer.
 */
export const context = new Elysia({ name: "kernel.context" })
  .onRequest(({ request, set }) => {
    const given = request.headers.get("x-request-id");
    metas.set(request, {
      requestId: given && /^[\w-]{1,64}$/.test(given) ? given : Bun.randomUUIDv7(),
      client: { ip: request.headers.get("x-client-ip") || "unknown", ua: request.headers.get("x-client-ua") ?? "" },
      start: performance.now(),
    });
    set.headers["cache-control"] = "no-store";
  })
  .onTransform({ as: "global" }, (c) => {
    c.query = firstValues(c.request.url);
  })
  .derive({ as: "global" }, ({ request }) => {
    const m = metas.get(request)!;
    return { requestId: m.requestId, client: m.client };
  })
  .onAfterResponse({ as: "global" }, ({ request, route, set, responseValue }) => {
    const m = metas.get(request);
    const status = m?.status ?? (responseValue instanceof Response ? responseValue.status : Number(set.status ?? 200));
    log.info({ method: request.method, route: route ?? null, status, ms: m ? Math.round(performance.now() - m.start) : null, requestId: m?.requestId }, "request");
  });
