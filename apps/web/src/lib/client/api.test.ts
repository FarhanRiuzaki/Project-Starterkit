import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, assertApiPath, download, isNotFound, setCsrf } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("api path guard", () => {
  it.each(["https://backend.example/api/x", "http://x", "//evil.example/api/x", "/users", "api/x", ""])("rejects %s", (p) => {
    expect(() => assertApiPath(p)).toThrow();
  });
  it("accepts /api/x", () => expect(() => assertApiPath("/api/x")).not.toThrow());
  it("api() throws before calling fetch", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(api("https://backend.example/api/x")).rejects.toThrow(/\/api\//);
    expect(f).not.toHaveBeenCalled();
  });
  it("api() sends /api/ paths", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await api("/api/x");
    expect(f).toHaveBeenCalledOnce();
  });
});

describe("api headers", () => {
  it("keeps headers given as a Headers instance or a tuple list, and adds the CSRF token on mutations", async () => {
    const f = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", f);
    setCsrf("tok");
    try {
      await api("/api/x", { method: "POST", headers: new Headers({ "x-extra": "1" }) });
      await api("/api/x", { method: "POST", headers: [["x-extra", "2"]] });
      await api("/api/x", { headers: { "content-type": "text/plain" } });
    } finally {
      setCsrf(null);
    }
    const sent = f.mock.calls.map((c) => new Headers((c as unknown as [string, RequestInit])[1].headers));
    expect(sent.map((h) => [h.get("x-extra"), h.get("x-csrf-token"), h.get("content-type")])).toEqual([
      ["1", "tok", "application/json"], ["2", "tok", "application/json"], [null, null, "text/plain"],
    ]);
  });
});

describe("isNotFound", () => {
  it("is true only for a 404 ApiError", () => {
    expect(isNotFound(new ApiError(404, "not_found", "x"))).toBe(true);
    expect(isNotFound(new ApiError(403, "forbidden", "x"))).toBe(false);
    expect(isNotFound(new Error("404"))).toBe(false);
  });
});

describe("download", () => {
  it("refuses a path outside /api/ before calling fetch", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(download("https://backend.example/api/x.csv", "x.csv")).rejects.toThrow(/\/api\//);
    expect(f).not.toHaveBeenCalled();
  });
  it("an error answer throws ApiError with the server's message, and saves nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "forbidden", message: "Your role doesn't allow this." } }, { status: 403 })));
    const created = vi.fn();
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: created }));
    await expect(download("/api/audit/activity?format=csv", "activity.csv")).rejects.toMatchObject({ status: 403, code: "forbidden", message: "Your role doesn't allow this." });
    expect(created).not.toHaveBeenCalled();
  });
});
