import { afterEach, describe, expect, it, vi } from "vitest";
import { api, assertApiPath, download } from "./api";

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
