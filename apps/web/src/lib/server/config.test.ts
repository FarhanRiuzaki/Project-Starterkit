import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONFIG_KEYS, DEV_API_BASE_URL, DEV_APP_URL, parseConfig } from "./config";

const TOKEN = "t".repeat(32);
const base = { SESSION_SECRET: "s".repeat(32), INTERNAL_API_TOKEN: TOKEN };
const prod = { ...base, NODE_ENV: "production", API_BASE_URL: "http://api:4000", APP_URL: "https://app.example.com" };

describe("config", () => {
  it("defaults: cookie not secure, 12 h sessions, the dev API address", () => {
    expect(parseConfig(base)).toEqual({ ...base, SESSION_TTL_HOURS: 12, COOKIE_SECURE: false, API_BASE_URL: DEV_API_BASE_URL, APP_URL: DEV_APP_URL, OAUTH_MOCK: false });
  });
  it("a secret shorter than 32 characters is refused", () => {
    expect(() => parseConfig({ ...base, SESSION_SECRET: "short" })).toThrow();
  });
  it("production requires SESSION_SECRET; dev gets one random secret per process", () => {
    expect(() => parseConfig({ ...prod, SESSION_SECRET: undefined })).toThrow(/SESSION_SECRET/);
    expect(() => parseConfig({ ...prod, SESSION_SECRET: "" })).toThrow(/SESSION_SECRET/);
    const a = parseConfig({ ...base, NODE_ENV: "development", SESSION_SECRET: "" }).SESSION_SECRET;
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(parseConfig({ INTERNAL_API_TOKEN: TOKEN }).SESSION_SECRET).toBe(a);
  });
  it("COOKIE_SECURE accepts only true/false", () => {
    expect(parseConfig({ ...base, COOKIE_SECURE: "true" }).COOKIE_SECURE).toBe(true);
    expect(() => parseConfig({ ...base, COOKIE_SECURE: "yes" })).toThrow();
  });
  it("API_BASE_URL: required in production, http(s) only, trailing slash dropped", () => {
    expect(() => parseConfig({ ...prod, API_BASE_URL: undefined })).toThrow(/API_BASE_URL/);
    expect(parseConfig({ ...prod, API_BASE_URL: "http://10.0.0.5:4000/" }).API_BASE_URL).toBe("http://10.0.0.5:4000");
    expect(parseConfig({ ...base, API_BASE_URL: "" }).API_BASE_URL).toBe(DEV_API_BASE_URL);
    for (const v of ["ftp://api", "api:4000"]) expect(() => parseConfig({ ...base, API_BASE_URL: v }), v).toThrow();
  });
  it("APP_URL (public origin for metadataBase): required in production, http(s) only, dev default", () => {
    expect(() => parseConfig({ ...prod, APP_URL: undefined })).toThrow(/APP_URL/);
    expect(() => parseConfig({ ...prod, APP_URL: "" })).toThrow(/APP_URL/);
    expect(parseConfig(prod).APP_URL).toBe("https://app.example.com");
    expect(parseConfig({ ...base, APP_URL: "" }).APP_URL).toBe(DEV_APP_URL);
    expect(DEV_APP_URL).toBe("http://localhost:3000");
    for (const v of ["ftp://app", "app.example.com"]) expect(() => parseConfig({ ...base, APP_URL: v }), v).toThrow();
  });
  it("INTERNAL_API_TOKEN is required, at least 32 characters", () => {
    expect(() => parseConfig({ SESSION_SECRET: base.SESSION_SECRET })).toThrow();
    expect(() => parseConfig({ ...base, INTERNAL_API_TOKEN: "x".repeat(31) })).toThrow();
  });
  it("OAUTH_MOCK: true/false only; refused in production over HTTPS (E2E runs a production build over plain HTTP)", () => {
    expect(parseConfig({ ...base, OAUTH_MOCK: "true" }).OAUTH_MOCK).toBe(true);
    expect(() => parseConfig({ ...base, OAUTH_MOCK: "yes" })).toThrow();
    expect(parseConfig({ ...prod, OAUTH_MOCK: "true" }).OAUTH_MOCK).toBe(true);
    expect(() => parseConfig({ ...prod, COOKIE_SECURE: "true", OAUTH_MOCK: "true" })).toThrow(/OAUTH_MOCK/);
    expect(parseConfig({ ...prod, COOKIE_SECURE: "true" }).OAUTH_MOCK).toBe(false);
  });
});

describe("apps/web/.env.example", () => {
  it("names every key of the config schema and the two read beside it (TRUSTED_PROXY, LOG_LEVEL)", () => {
    const text = readFileSync(path.resolve(import.meta.dirname, "../../../.env.example"), "utf8");
    const named = new Set([...text.matchAll(/^(?:# ?)?([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
    expect([...CONFIG_KEYS, "TRUSTED_PROXY", "LOG_LEVEL"].filter((k) => !named.has(k))).toEqual([]);
  });
});
