// The kernel plugins on an Elysia app without the Hono mount (the shape every route has after Task 18).
import { describe, expect, it, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { request } from "../../../../test/helpers/app";
import { log } from "../../log";
import { bodyLimit } from "../../plugins/body-limit";
import { context } from "../../plugins/context";
import { errorHandler } from "../../plugins/error";
import { internalAuth } from "../../plugins/internal-auth";

const TOKEN = { "X-Internal-Token": process.env.INTERNAL_API_TOKEN! };
const kernelApp = () =>
  new Elysia().use(errorHandler).use(context).use(bodyLimit).use(internalAuth)
    .get("/v1/things/:id", ({ requestId, client }) => ({ requestId, client }))
    .post("/v1/echo", ({ body }) => ({ length: (body as string).length }));

describe("kernel plugins", () => {
  it("an unknown path is 404 not_found with the fixed copy and no-store; without the token it is 401 first", async () => {
    const res = await request(kernelApp(), "/v1/nope", { headers: TOKEN });
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "This page doesn't exist or was deleted." } });
    expect((await request(kernelApp(), "/v1/nope")).status).toBe(401);
  });

  it("the handler sees the request id from Next (or a new one) and the client from X-Client-*", async () => {
    const res = await request(kernelApp(), "/v1/things/1", { headers: { ...TOKEN, "X-Request-Id": "req-7", "X-Client-Ip": "10.0.0.9", "X-Client-Ua": "UA" } });
    expect(await res.json()).toEqual({ requestId: "req-7", client: { ip: "10.0.0.9", ua: "UA" } });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const own = (await (await request(kernelApp(), "/v1/things/1", { headers: { ...TOKEN, "X-Request-Id": "bad id!" } })).json()) as { requestId: string; client: unknown };
    expect(own.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(own.client).toEqual({ ip: "unknown", ua: "" });
  });

  it("one access log line per request: method, route pattern, status, ms and request id, never the query", async () => {
    const spy = spyOn(log, "info");
    try {
      await request(kernelApp(), "/v1/things/1?secret=x", { headers: { ...TOKEN, "X-Request-Id": "req-8" } });
      await request(kernelApp(), "/v1/things/1", { headers: { "X-Request-Id": "req-9" } });
      await Bun.sleep(10); // the line is written after the response
      // Earlier tests' lines may land here too: keep this test's two.
      const lines = spy.mock.calls.map((c) => c[0] as Record<string, unknown>).filter((l) => l.requestId === "req-8" || l.requestId === "req-9");
      expect(lines).toEqual([
        { method: "GET", route: "/v1/things/:id", status: 200, ms: expect.any(Number), requestId: "req-8" },
        { method: "GET", route: null, status: 401, ms: expect.any(Number), requestId: "req-9" },
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it("a body over 64 KB without Content-Length is 400 while it is read", async () => {
    const big = new TextEncoder().encode(JSON.stringify({ x: "y".repeat(70 * 1024) }));
    const stream = () => new ReadableStream({ start(c) { c.enqueue(big); c.close(); } });
    const res = await request(kernelApp(), "/v1/echo", { method: "POST", headers: { ...TOKEN, "Content-Type": "application/json" }, body: stream() });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("bad_request");
    const ok = await request(kernelApp(), "/v1/echo", { method: "POST", headers: { ...TOKEN, "Content-Type": "application/json" }, body: '{"a":1}' });
    expect(await ok.json()).toEqual({ length: 7 });
  });
});
