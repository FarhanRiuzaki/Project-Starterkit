import { describe, expect, it } from "bun:test";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const API = join(import.meta.dir, "../..");

describe("schema.ts and the migrations agree", () => {
  it("drizzle-kit finds nothing to generate: every table, column and index in a schema.ts has its migration", async () => {
    // On a copy of drizzle/, so a missing migration is reported, never written. drizzle-kit prefixes `--out` with "./".
    const dir = await mkdtemp(join(tmpdir(), "drift-"));
    try {
      await cp(join(API, "drizzle"), join(dir, "drizzle"), { recursive: true });
      const before = await readdir(join(dir, "drizzle"));
      const kit = Bun.spawnSync(["bunx", "drizzle-kit", "generate", "--dialect=postgresql", "--schema=./src/modules/*/schema.ts", `--out=${relative(API, join(dir, "drizzle"))}`], { cwd: API });
      const out = kit.stdout.toString() + kit.stderr.toString();
      expect(kit.exitCode).toBe(0);
      expect((await readdir(join(dir, "drizzle"))).filter((f) => !before.includes(f)), "a schema.ts change without its migration: run `bun run db:generate -- --name=<name>`").toEqual([]);
      expect(out).toContain("No schema changes");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
