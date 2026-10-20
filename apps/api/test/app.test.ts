import { describe, expect, it, spyOn } from "bun:test";
import { z } from "zod";
import { createApp } from "../src/app";
import { log } from "../src/kernel/log";
import { body } from "../src/kernel/parse";
import { LEGACY_MOUNT_ROUTE } from "../src/kernel/plugins/context";
import { request, resetData, signIn } from "./helpers/app";

type ErrorJson = { error: { code: string; message: string } };
const code = async (res: Response) => ((await res.json()) as ErrorJson).error.code;

const TOKEN = process.env.INTERNAL_API_TOKEN!;
const auth = { "X-Internal-Token": TOKEN };

describe("app", () => {
  it("a /v1 request without X-Internal-Token is 401 unauthenticated", async () => {
    const res = await request(createApp(), "/v1/anything");
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthenticated");
  });

  it("the Hono routers are mounted on the route the access log leaves to them", () => {
    expect(createApp().routes.filter((r) => r.path === LEGACY_MOUNT_ROUTE).map((r) => r.method)).toEqual(["ALL"]);
  });

  it("a wrong token of the same length is 401", async () => {
    const wrong = TOKEN.slice(0, -1) + (TOKEN.endsWith("a") ? "b" : "a");
    const res = await request(createApp(), "/v1/anything", { headers: { "X-Internal-Token": wrong } });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthenticated");
  });

  it("the token is checked on the decoded path: an encoded, doubled or upper-case /v1 is 401 without it", async () => {
    for (const p of ["/%761/auth/providers", "/v1%2fauth/providers", "/V1/auth/providers", "//v1/auth/providers", "/x/../v1/auth/providers", "/%zz"]) {
      const res = await request(createApp(), p);
      expect([p, res.status, await code(res)]).toEqual([p, 401, "unauthenticated"]);
    }
  });

  it("without the token every path but the health checks is 401, an unknown one too (routes stay hidden)", async () => {
    for (const p of ["/nope", "/", "/healthz/x", "/v2/users"]) expect([p, (await request(createApp(), p)).status]).toEqual([p, 401]);
    expect((await request(createApp(), "/healthz")).status).toBe(200);
    expect((await request(createApp(), "/healthz", { method: "POST" })).status).toBe(401);
  });

  it("the health allowlist is the exact path: a dot-segment, backslash or encoded spelling of /healthz needs the token", async () => {
    await resetData();
    const bearer = { Authorization: `Bearer ${await signIn("admin")}` };
    const cases: [string, Record<string, string>][] = [
      ["/v1/auth/providers/..%2f..%2f..%2fhealthz", {}], ["/v1/users/..%2f..%2fhealthz", bearer], ["/v1/users/..%5c..%5chealthz", {}],
      ["/healthz%2f..%2fv1/auth/providers", {}], ["/%68ealthz", {}],
    ];
    for (const [p, headers] of cases) {
      const res = await request(createApp(), p, { headers });
      expect([p, res.status, await code(res)]).toEqual([p, 401, "unauthenticated"]);
    }
    for (const p of ["/healthz", "/readyz", "/healthz?x=/v1"]) {
      const res = await request(createApp(), p);
      expect([p, res.status, await res.json()]).toEqual([p, 200, { ok: true }]);
    }
  });

  it("unknown /v1 path is 404 not_found with no-store", async () => {
    const res = await request(createApp(), "/v1/nope", { headers: auth });
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "This page doesn't exist or was deleted." } });
  });

  it("a thrown Error answers 500 internal with the fixed message and never its text", async () => {
    const secret = "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP leaked";
    const app = createApp().get("/v1/boom", () => {
      throw new Error(secret);
    });
    const spy = spyOn(log, "error");
    try {
      const res = await request(app, "/v1/boom", { headers: auth });
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
    const app = createApp().get("/v1/boom", () => {
      throw "secret-string";
    });
    const spy = spyOn(log, "error");
    try {
      const res = await request(app, "/v1/boom", { headers: auth });
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
    const app = createApp().get("/v1/parse", () => z.string().parse(1));
    const res = await request(app, "/v1/parse", { headers: auth });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("bad_request");
  });

  it("a body over 64 KB is 400 bad_request", async () => {
    const app = createApp().post("/v1/echo", (c) => body(c, z.unknown()));
    const big = JSON.stringify({ x: "y".repeat(70 * 1024) });
    const res = await request(app, "/v1/echo", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: big });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("bad_request");
    const ok = await request(app, "/v1/echo", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: '{"a":1}' });
    expect(await ok.json()).toEqual({ a: 1 });
  });

});
