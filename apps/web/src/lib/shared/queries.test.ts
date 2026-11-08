import { describe, expect, it } from "vitest";
import * as q from "./queries";

/** Query keys start with the module that owns the data, so one invalidation by module refreshes all of it. */
const MODULES = ["users", "rbac", "me", "audit", "dashboard"];

describe("query keys: one scheme", () => {
  it("every key and table key exported by queries.ts starts with a module name", () => {
    const firsts = Object.entries(q).flatMap(([name, v]): [string, unknown][] => {
      if (Array.isArray(v)) return name.endsWith("_KEY") ? [[name, v[0]]] : [];
      if (v && typeof v === "object" && "key" in v) return [[name, Array.isArray(v.key) ? v.key[0] : v.key]];
      if (typeof v === "function" && v.length === 1) {
        const r = name === "dashboardRead" ? q.dashboardRead(new URLSearchParams("range=7d")) : (v as (x: string) => unknown)("x");
        if (Array.isArray(r)) return [[name, r[0]]];
        if (r && typeof r === "object" && "key" in r) return [[name, Array.isArray(r.key) ? r.key[0] : r.key]];
      }
      return [];
    });
    expect(firsts.length).toBeGreaterThan(10);
    expect(firsts.filter(([, k]) => !MODULES.includes(k as string))).toEqual([]);
  });
});

it("dashboard range uses the same dated request as its cache key, without refresh in the key", () => {
  const a = q.dashboardRead(new URLSearchParams("from=2026-11-01&to=2026-11-03&refresh=30"));
  expect(a).toEqual({ key: ["dashboard", "/api/dashboard?from=2026-11-01&to=2026-11-03"], path: "/api/dashboard?from=2026-11-01&to=2026-11-03" });
  expect(q.dashboardRead(new URLSearchParams("refresh=30"))).toEqual({ key: ["dashboard"], path: "/api/dashboard" });
});


it("relative timestamp filters stay in stable API paths and keys for refresh and SSR", () => {
  const params = new URLSearchParams({ start: "now-15m", end: "now", refresh: "30" });
  const read = q.dashboardRead(params);
  expect(read.path).toBe("/api/dashboard?start=now-15m&end=now");
  expect(read.key).toEqual(["dashboard", read.path]);
  const filters = { range: "7d" as const, from: "", to: "", start: "now-15m", end: "now", user: "Alex", event: "" as const, method: "" as const };
  expect(q.AUTH_LOG.params!(filters)).toMatchObject({ start: "now-15m", end: "now", user: "Alex" });
});
