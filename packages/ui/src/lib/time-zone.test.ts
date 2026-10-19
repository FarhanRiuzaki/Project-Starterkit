import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(d, e.name)] : []);
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("one app time zone", () => {
  it("the UTC offset and the zone label are written only in lib/format.ts", () => {
    const bad = walk(SRC)
      .filter((f) => path.basename(f) !== "format.ts")
      .filter((f) => /7\s*\*\s*3600|25_?200|["'`>\s]WIB\b/.test(strip(readFileSync(f, "utf8"))))
      .map((f) => path.relative(SRC, f));
    expect(bad).toEqual([]);
  });
});
