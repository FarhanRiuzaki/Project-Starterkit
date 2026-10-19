import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SRC = path.resolve(import.meta.dirname, "..");
export const WEB_SRC = SRC;
export const UI_SRC = path.resolve(SRC, "../../../packages/ui/src");

/** All files under `roots` whose name matches `ext` (default ts/tsx, tests excluded). */
export function scan(roots: string[] = [SRC], ext: RegExp = /\.(ts|tsx)$/, withTests = false): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (ext.test(name) && (withTests || !/\.test\.tsx?$/.test(name))) out.push(p);
    }
  };
  for (const r of roots) walk(r);
  return out;
}

export const listSource = (dir = SRC): string[] => scan([dir]);
export const read = (p: string) => readFileSync(p, "utf8");
export const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");

export function importsOf(file: string): string[] {
  const s = readFileSync(file, "utf8");
  return [...s.matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)]
    .map((m) => m[1] ?? m[2] ?? "");
}
