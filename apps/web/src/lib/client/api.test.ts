import { afterEach, describe, expect, it, vi } from "vitest";
import { api, assertApiPath } from "./api";

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
