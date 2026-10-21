import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as q from "./queries";

/**
 * Query keys start with the module that owns the data, so one invalidation by module refreshes all of it. The modules
 * are the API's (`apps/api/src/modules/<m>/`), so a new module's keys pass without editing this test.
 */
const MODULES = readdirSync(path.resolve(import.meta.dirname, "../../../../api/src/modules"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name);

describe("query keys: one scheme", () => {
  it("every key and table key exported by queries.ts starts with a module name", () => {
    const firsts = Object.entries(q).flatMap(([name, v]): [string, unknown][] => {
      if (Array.isArray(v)) return name.endsWith("_KEY") ? [[name, v[0]]] : [];
      if (v && typeof v === "object" && "key" in v) return [[name, Array.isArray(v.key) ? v.key[0] : v.key]];
      if (typeof v === "function" && v.length === 1) {
        const r = (v as (x: string) => unknown)("x");
        if (Array.isArray(r)) return [[name, r[0]]];
        if (r && typeof r === "object" && "key" in r) return [[name, Array.isArray(r.key) ? r.key[0] : r.key]];
      }
      return [];
    });
    expect(firsts.length).toBeGreaterThan(10);
    expect(firsts.filter(([, k]) => !MODULES.includes(k as string))).toEqual([]);
  });
});
