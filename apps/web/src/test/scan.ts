import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SRC = path.resolve(import.meta.dirname, "..");
export const WEB_SRC = SRC;
export const UI_SRC = path.resolve(SRC, "../../../packages/ui/src");
export const REPO = path.resolve(SRC, "../../..");

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
/** Path relative to the repo root ("apps/web/src/…", "packages/ui/src/…"). */
export const repoRel = (p: string) => path.relative(REPO, p).split(path.sep).join("/");

/** Module specifiers a file imports: `import … from`, `export … from`, side-effect `import "x"` and `import("x")`. */
export const importsOf = (file: string): string[] => importsIn(readFileSync(file, "utf8"));
export function importsIn(src: string): string[] {
  return [...strip(src).matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? "");
}

/**
 * Source without comments, string-aware: a "//" or "/*" inside a string, template or regex literal stays
 * ("https://x", /\/\/.*$/). A "/" starts a regex literal after an operator, a bracket or a keyword-free line start.
 */
export function strip(s: string): string {
  let out = "";
  let i = 0;
  // Not after "}" (a block end or a JSX expression) and never "/>" (a self-closing JSX tag).
  const regexAllowed = () => s[i + 1] !== ">" && /(?:^|[=(,:;!&|?{[+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*$/.test(out.slice(-40));
  while (i < s.length) {
    const c = s[i]!, n = s[i + 1];
    if (c === "/" && n === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const end = s.indexOf("*/", i + 2); i = end < 0 ? s.length : end + 2; continue; }
    if (c === '"' || c === "'" || c === "`" || (c === "/" && regexAllowed())) {
      const start = i++;
      let cls = false; // inside a regex character class, "/" doesn't close
      while (i < s.length && (s[i] !== c || cls)) {
        if (s[i] === "\\") i++;
        else if (c === "/" && s[i] === "[") cls = true;
        else if (c === "/" && s[i] === "]") cls = false;
        else if (c !== "`" && s[i] === "\n") break; // unterminated: give the line back
        i++;
      }
      out += s.slice(start, ++i);
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
