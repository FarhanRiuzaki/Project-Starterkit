import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

describe("config", () => {
  it("defaults: cookie not secure, 12 h sessions", () => {
    const c = parseConfig({ SESSION_SECRET: "s".repeat(32) });
    expect(c).toEqual({ SESSION_SECRET: "s".repeat(32), SESSION_TTL_HOURS: 12, COOKIE_SECURE: false });
  });
  it("a secret shorter than 32 characters is refused", () => {
    expect(() => parseConfig({ SESSION_SECRET: "short" })).toThrow();
  });
  it("production requires SESSION_SECRET; dev gets one random secret per process", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
    expect(() => parseConfig({ NODE_ENV: "production", SESSION_SECRET: "" })).toThrow(/SESSION_SECRET/);
    const a = parseConfig({ NODE_ENV: "development", SESSION_SECRET: "" }).SESSION_SECRET;
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(parseConfig({}).SESSION_SECRET).toBe(a);
  });
  it("COOKIE_SECURE accepts only true/false", () => {
    expect(parseConfig({ SESSION_SECRET: "s".repeat(32), COOKIE_SECURE: "true" }).COOKIE_SECURE).toBe(true);
    expect(() => parseConfig({ SESSION_SECRET: "s".repeat(32), COOKIE_SECURE: "yes" })).toThrow();
  });
});
