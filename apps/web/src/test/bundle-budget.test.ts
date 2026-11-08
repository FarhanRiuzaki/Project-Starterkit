import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { gzipSync } from "node:zlib";
// @ts-expect-error: plain .mjs script without types
import { budgetFrom } from "../../scripts/bundle-budget.mjs";

describe("bundle-budget arguments", () => {
  it("reads --budget wherever it is; defaults to 250 kB", () => {
    expect(budgetFrom([], {})).toBe(250);
    expect(budgetFrom(["--json"], {})).toBe(250); // was NaN: the value after a missing --budget is args[0]
    expect(budgetFrom(["--json", "--budget", "180"], {})).toBe(180);
    expect(budgetFrom([], { BUNDLE_BUDGET_KB: "200" })).toBe(200);
  });
  it("refuses a budget that isn't a positive number (a NaN budget would pass every route)", () => {
    for (const a of [["--budget"], ["--budget", "abc"], ["--budget", "0"], ["--budget", "--json"]]) expect(() => budgetFrom(a, {}), a.join(" ")).toThrow(/budget/);
    expect(() => budgetFrom([], { BUNDLE_BUDGET_KB: "x" })).toThrow(/budget/);
  });
});

describe("bundle-budget byte boundary", () => {
  it("accepts the exact budget and rejects one byte over, even when both display the same rounded size", () => {
    const web = path.resolve(import.meta.dirname, "../..");
    const scratch = path.resolve(web, "../../.superpowers/scratch");
    mkdirSync(scratch, { recursive: true });
    const fixture = mkdtempSync(path.join(scratch, "budget-boundary-"));
    try {
      // Deterministic incompressible fixture: gzip level 9 produces exactly 256,000 and 256,001 bytes.
      const content = Buffer.alloc(255_903);
      let seed = 0x12345678;
      for (let i = 0; i < content.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; content[i] = seed & 255; }
      const chunk = content.subarray(0, 255_902);
      const bytes = gzipSync(chunk, { level: 9 }).length;
      expect(bytes).toBe(256_000);
      mkdirSync(path.join(fixture, "server/app/users"), { recursive: true });
      writeFileSync(path.join(fixture, "chunk.js"), chunk);
      writeFileSync(path.join(fixture, "build-manifest.json"), JSON.stringify({ rootMainFiles: ["chunk.js"] }));
      writeFileSync(path.join(fixture, "server/app/users/page_client-reference-manifest.js"),
        'globalThis.__RSC_MANIFEST = { "/users/page": { entryJSFiles: { page: ["chunk.js"] } } };');
      const run = () => spawnSync(process.execPath,
        [path.join(web, "scripts/bundle-budget.mjs"), "--json", "--budget", "250"],
        { encoding: "utf8", env: { ...process.env, NEXT_DIST_DIR: path.relative(web, fixture) } });
      const exact = run();
      expect(exact.status, exact.stderr).toBe(0);
      writeFileSync(path.join(fixture, "chunk.js"), content);
      expect(gzipSync(content, { level: 9 }).length).toBe(256_001);
      const over = run();
      expect(over.status, over.stderr).toBe(1);
      expect(over.stderr).toContain("1 route(s) over");
      // The root and route share one chunk; it must be counted only once.
      expect(JSON.parse(exact.stdout).rows[0]).toMatchObject({ route: "/users", bytes, chunks: 1 });
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
