import { afterEach, describe, expect, it, vi } from "vitest";

const TOKEN = vi.hoisted(() => (process.env.INTERNAL_API_TOKEN = "i".repeat(40)));

import { fakeApi } from "@/test/session";
import { backend, backendJson, INTERNAL_COPY } from "./backend";
import { DEV_API_BASE_URL } from "./config";
import { log } from "./logger";

const refused = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:4000"), { code: "ECONNREFUSED" }) });
const errorOf = async (r: Response) => ((await r.json()) as { error: { code: string; message: string } }).error;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("backend", () => {
  it("sends X-Internal-Token and client headers", async () => {
    const seen = fakeApi(() => Response.json({ ok: true }));
    const req = new Request("http://c/api/users", { headers: { "user-agent": "Browser/1", "x-forwarded-for": "9.9.9.9" } });
    await backend("/v1/users?page=2", { token: "tok", challenge: "ch", req });
    await backend("/v1/me/password", { method: "POST", body: '{"a":1}', contentType: "application/json" });
    const [get, post] = seen;
    expect(get!.url).toBe(`${DEV_API_BASE_URL}/v1/users?page=2`);
    expect(get!.method).toBe("GET");
    expect(Object.fromEntries(get!.headers)).toMatchObject({
      "x-internal-token": TOKEN, authorization: "Bearer tok", "x-auth-challenge": "ch",
      "x-client-ip": "unknown", // X-Forwarded-For counts only with TRUSTED_PROXY
      "x-client-ua": "Browser/1",
    });
    expect(get!.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(post!.method).toBe("POST");
    expect(post!.headers.get("authorization")).toBeNull();
    expect(post!.headers.get("x-auth-challenge")).toBeNull();
    expect(post!.headers.get("content-type")).toBe("application/json");
    expect(await post!.text()).toBe('{"a":1}');
    expect(post!.headers.get("x-request-id")).not.toBe(get!.headers.get("x-request-id"));
  });

  it("GET retries once on ECONNREFUSED, POST never", async () => {
    const err = vi.spyOn(log, "error").mockImplementation(() => undefined);
    let n = 0;
    fakeApi(() => { n++; throw refused(); });
    const get = await backend("/v1/users");
    expect(n).toBe(2);
    expect(get.status).toBe(500);
    expect(await errorOf(get)).toEqual({ code: "internal", message: INTERNAL_COPY });
    n = 0;
    const post = await backend("/v1/users", { method: "POST", body: "{}" });
    expect(n).toBe(1);
    expect(post.status).toBe(500);
    expect(err).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(err.mock.calls)).not.toContain(TOKEN);

    n = 0;
    fakeApi(() => (++n === 1 ? Promise.reject(refused()) : Response.json({ ok: true })));
    expect((await backend("/v1/me")).status).toBe(200); // the retry answered
    expect(n).toBe(2);
  });

  it("a timeout is not retried and answers the fixed 500", async () => {
    vi.spyOn(log, "error").mockImplementation(() => undefined);
    let n = 0;
    fakeApi(() => { n++; throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); });
    const r = await backend("/v1/users");
    expect(n).toBe(1);
    expect(r.status).toBe(500);
    expect((await errorOf(r)).code).toBe("internal");
  });

  it("backendJson: the status, and the JSON of a 2xx answer only", async () => {
    fakeApi((r) => (r.url.endsWith("/v1/me") ? Response.json({ id: "1" }) : Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 })));
    expect(await backendJson("/v1/me")).toEqual({ status: 200, data: { id: "1" } });
    expect(await backendJson("/v1/roles/x")).toEqual({ status: 404, data: null });
  });
});
