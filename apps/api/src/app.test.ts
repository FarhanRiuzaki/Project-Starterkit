import { describe, expect, it, spyOn } from "bun:test";
import { SQL } from "bun";
import { z } from "zod";
import { createApp } from "./app";
import { log } from "./log";

type ErrorJson = { error: { code: string; message: string } };
const code = async (res: Response) => ((await res.json()) as ErrorJson).error.code;

const TOKEN = process.env.INTERNAL_API_TOKEN!;
const auth = { "X-Internal-Token": TOKEN };

describe("app", () => {
  it("healthz needs no token", async () => {
    const res = await createApp().request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("readyz answers ok when the database does", async () => {
    const res = await createApp().request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("a /v1 request without X-Internal-Token is 401 unauthenticated", async () => {
    const res = await createApp().request("/v1/anything");
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthenticated");
  });

  it("a wrong token of the same length is 401", async () => {
    const wrong = TOKEN.slice(0, -1) + (TOKEN.endsWith("a") ? "b" : "a");
    const res = await createApp().request("/v1/anything", { headers: { "X-Internal-Token": wrong } });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthenticated");
  });

  it("unknown /v1 path is 404 not_found with no-store", async () => {
    const res = await createApp().request("/v1/nope", { headers: auth });
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "This page doesn't exist or was deleted." } });
  });

  it("a thrown Error answers 500 internal with the fixed message and never its text", async () => {
    const app = createApp();
    const secret = "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP leaked";
    app.get("/v1/boom", () => {
      throw new Error(secret);
    });
    const spy = spyOn(log, "error");
    try {
      const res = await app.request("/v1/boom", { headers: auth });
      expect(res.status).toBe(500);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const text = await res.text();
      expect(JSON.parse(text).error).toEqual({
        code: "internal",
        message: "The server hit an unexpected error. Try again; if it continues, contact your administrator.",
      });
      expect(text).not.toContain("leaked");
      expect(spy).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(spy.mock.calls[0]);
      expect(logged).not.toContain("JBSWY3DPEHPK3PXP");
      expect(logged).toContain("Error");
    } finally {
      spy.mockRestore();
    }
  });

  it("a thrown non-Error answers the same fixed 500 and never its value", async () => {
    const app = createApp();
    app.get("/v1/boom", () => {
      throw "secret-string";
    });
    const spy = spyOn(log, "error");
    try {
      const res = await app.request("/v1/boom", { headers: auth });
      expect(res.status).toBe(500);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const text = await res.text();
      expect((JSON.parse(text) as ErrorJson).error.code).toBe("internal");
      expect(text + JSON.stringify(spy.mock.calls)).not.toContain("secret-string");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("a zod error answers 400 bad_request", async () => {
    const app = createApp();
    app.get("/v1/parse", (c) => c.json(z.string().parse(1)));
    const res = await app.request("/v1/parse", { headers: auth });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("bad_request");
  });

  it("a body over 64 KB is 400 bad_request", async () => {
    const app = createApp();
    app.post("/v1/echo", async (c) => c.json(await c.req.json()));
    const big = JSON.stringify({ x: "y".repeat(70 * 1024) });
    const res = await app.request("/v1/echo", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: big });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("bad_request");
    const ok = await app.request("/v1/echo", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: '{"a":1}' });
    expect(await ok.json()).toEqual({ a: 1 });
  });

  it("db down: readyz 503", async () => {
    const down = new SQL("postgresql://nobody:nothing@127.0.0.1:1/none", { max: 1, connectionTimeout: 1 });
    const res = await createApp({ db: down }).request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    await down.close();
  });

  it("db that never answers: readyz 503 after 2 s", async () => {
    const hung = (() => new Promise(() => {})) as unknown as SQL;
    const start = performance.now();
    const res = await createApp({ db: hung }).request("/readyz");
    expect(res.status).toBe(503);
    expect(performance.now() - start).toBeGreaterThanOrEqual(1900);
  });
});
