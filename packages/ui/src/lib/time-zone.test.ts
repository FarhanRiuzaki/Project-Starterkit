import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(d, e.name)] : []);
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/**
 * The UTC offset, the zone label and zone-named helpers live only in lib/format.ts (APP_UTC_OFFSET_SEC,
 * APP_TIME_ZONE_LABEL, formatDate/formatTime/formatDateTime): moving the app to another zone is a one-file change.
 */
const ZONE_LITERAL = /7\s*\*\s*(?:3600|60\s*\*\s*60)|25_?200|["'`>(\s]WIB\b|\bUTC\s*\+\s*7\b|\w+WIB\b/;

describe("one app time zone", () => {
  it("the UTC offset and the zone label are written only in lib/format.ts", () => {
    const bad = walk(SRC)
      .filter((f) => path.basename(f) !== "format.ts")
      .filter((f) => ZONE_LITERAL.test(strip(readFileSync(f, "utf8"))))
      .map((f) => path.relative(SRC, f));
    expect(bad).toEqual([]);
  });
  it("format.ts exports zone-neutral names", () => {
    expect(/export function \w*WIB\b/.test(readFileSync(path.join(SRC, "lib/format.ts"), "utf8"))).toBe(false);
  });
  it("guard fixtures: each way to write the zone is caught", () => {
    for (const s of ["const o = 7 * 3600;", "const o = 7*60*60;", "x = 25200", "`14:00 WIB`", "label (WIB)", "\"UTC+7\"", "formatDateWIB(x)"]) expect(ZONE_LITERAL.test(s), s).toBe(true);
    for (const s of ["formatDate(x)", "APP_TIME_ZONE_LABEL", "7 * 24"]) expect(ZONE_LITERAL.test(s), s).toBe(false);
  });
});
