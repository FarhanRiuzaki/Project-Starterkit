import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsOf, read, REPO, repoRel, scan, UI_SRC, WEB_SRC } from "./scan";

type F = { r: string; src: string; imp: string[] };

const WEB = "apps/web/src/";
const UI = "packages/ui/src/";
const files: F[] = scan([WEB_SRC, UI_SRC]).map((f) => ({ r: repoRel(f), src: read(f), imp: importsOf(f) }));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** ui/motion/lib = primitives (0) → ds (1) → charts (2) → shell (3) → features (4). */
const layer = (r: string) =>
  [`${UI}ui/`, `${UI}motion/`, `${UI}lib/`].some((p) => r.startsWith(p)) ? 0 : r.startsWith(`${UI}ds/`) ? 1
    : r.startsWith(`${UI}charts/`) ? 2 : r.startsWith(`${WEB}components/shell/`) ? 3 : r.startsWith(`${WEB}features/`) ? 4 : null;
/** Import specifier → repo-relative path ("@/x", "@starterkit/ui/x", "./x" all resolve); other packages → null. */
const resolveSpec = (fromRel: string, spec: string): string | null =>
  spec.startsWith("@/") ? WEB + spec.slice(2)
    : spec.startsWith("@starterkit/ui/") ? UI + spec.slice("@starterkit/ui/".length)
    : spec.startsWith(".") ? repoRel(path.resolve(REPO, path.dirname(fromRel), spec))
    : null;
const featureOf = (r: string) => (r.startsWith(`${WEB}features/`) ? r.split("/")[4] ?? null : null);

function layerViolations(fs: F[]): string[] {
  return fs.flatMap(({ r, imp }) => {
    const me = layer(r);
    if (me == null) return [];
    return imp.filter((s) => { const t = resolveSpec(r, s); const l = t == null ? null : layer(`${t}/`); return l != null && l > me; })
      .map((s) => `${r} → ${s}`);
  });
}

function siblingFeatureViolations(fs: F[]): string[] {
  return fs.flatMap(({ r, imp }) => {
    const me = featureOf(r);
    if (me == null) return [];
    return imp.filter((s) => { const t = resolveSpec(r, s); const f = t == null ? null : featureOf(t); return f != null && f !== me; })
      .map((s) => `${r} → ${s}`);
  });
}

function clientImportsServer(fs: F[]): string[] {
  return fs.filter(({ r, src, imp }) => /^["']use client["']/m.test(src)
    && imp.some((s) => resolveSpec(r, s)?.startsWith(`${WEB}lib/server`))).map(({ r }) => r);
}

/**
 * Browser code reaches the backend only through same-origin `/api/*` (CSP connect-src 'self'; the backend URL is
 * server env only). Client = features/, components/, lib/client/, or any file with "use client".
 */
const isClient = ({ r, src }: F) => /^["']use client["']/m.test(src)
  || [`${WEB}features/`, `${WEB}components/`, `${WEB}lib/client/`].some((p) => r.startsWith(p));
function clientApiViolations(fs: F[]): string[] {
  return fs.filter(isClient).flatMap(({ r, src: raw }) => {
    // Comments only: a "//" inside a string ("https://…") must not swallow the rest of the line.
    const src = raw.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "$1");
    // First argument written as a string or template literal must start with "/api/" (not http(s)://, //, a ${base}).
    const calls = [...src.matchAll(/\b(fetch|api)\s*(?:<[^<>()]*>)?\(\s*(["'`])([^]{0,12})/g)]
      .filter((m) => !m[3]!.startsWith("/api/")).map((m) => `${r}: ${m[1]}(${m[2]}${m[3]!.split(m[2]!)[0]}…) must start with "/api/"`);
    const env = [...src.matchAll(/process\.env\.NEXT_PUBLIC_\w*(?:API|URL)\w*/g)].map((m) => `${r}: ${m[0]} exposes a backend URL to the browser`);
    return [...calls, ...env];
  });
}

const METHODS = "GET|POST|PUT|PATCH|DELETE";
/** Exported HTTP handlers of a route file with their source text (up to the next exported handler). */
const handlers = (src: string) => {
  const hits = [...src.matchAll(new RegExp(`export\\s+(?:async\\s+)?function\\s+(${METHODS})\\b`, "g"))];
  return hits.map((m, i) => ({ method: m[1]!, body: src.slice(m.index, hits[i + 1]?.index ?? src.length) }));
};

/**
 * Every route handler outside app/api/auth/** runs inside withPermission(, and every non-GET one calls
 * recordActivity(. Handlers must be function declarations (an `export const POST =` would escape the check).
 */
function routeViolations(fs: F[]): string[] {
  return fs.filter(({ r }) => new RegExp(`^${WEB}app/api/(.+/)?route\\.tsx?$`).test(r) && !r.startsWith(`${WEB}app/api/auth/`))
    .flatMap(({ r, src: raw }) => {
      const src = strip(raw);
      if (new RegExp(`export\\s+(?:const|let|var)\\s+(?:${METHODS})\\b|export\\s*\\{[^}]*\\b(?:${METHODS})\\b`).test(src)) {
        return [`${r}: export each handler as a function declaration`];
      }
      const hs = handlers(src);
      if (hs.length === 0) return [`${r}: no exported handler found`];
      return hs.flatMap((h) => [
        ...(/\bwithPermission\(/.test(h.body) ? [] : [`${r} ${h.method}: no withPermission(`]),
        ...(h.method === "GET" || /\brecordActivity\(/.test(h.body) ? [] : [`${r} ${h.method}: no recordActivity(`]),
      ]);
    });
}

describe("architecture", () => {
  it("layers import downward only (ui/motion → ds → charts → components/shell → features)", () => {
    expect(layerViolations(files)).toEqual([]);
  });

  it("a feature never imports a sibling feature (alias or relative path)", () => {
    expect(siblingFeatureViolations(files)).toEqual([]);
  });

  it("every API route handler outside app/api/auth/** calls withPermission(; every non-GET one calls recordActivity(", () => {
    expect(routeViolations(files)).toEqual([]);
  });

  it("client code never imports lib/server", () => {
    expect(clientImportsServer(files)).toEqual([]);
  });

  it("lib/shared is pure (no React, Next, lib/server or components)", () => {
    const bad = files.filter(({ r, imp }) => r.startsWith(`${WEB}lib/shared/`) && imp.some((s) => {
      const t = resolveSpec(r, s);
      return /^(react|next)(\/|$)/.test(s) || !!t?.startsWith(`${WEB}lib/server`) || !!t?.startsWith(`${WEB}components`) || !!t?.startsWith(`${WEB}features`);
    }));
    expect(bad.map((f) => f.r)).toEqual([]);
  });

  it("client code calls only same-origin /api/ and reads no NEXT_PUBLIC API/URL variable", () => {
    expect(clientApiViolations(files)).toEqual([]);
  });

  it("no dangerouslySetInnerHTML", () => {
    expect(files.filter(({ src }) => src.includes("dangerouslySetInnerHTML")).map((f) => f.r)).toEqual([]);
  });

  it("only charts imports recharts", () => {
    expect(files.filter(({ r, imp }) => imp.includes("recharts") && !r.startsWith(`${UI}charts/`)).map((f) => f.r)).toEqual([]);
  });

  it("only packages/ui/src/motion/framer.tsx imports motion", () => {
    const bad = files.filter(({ r, imp }) => imp.some((s) => s === "motion" || s.startsWith("motion/") || s.startsWith("framer-motion"))
      && r !== `${UI}motion/framer.tsx`);
    expect(bad.map((f) => f.r)).toEqual([]);
  });

  it("icons: only packages/ui/src/ui/icons.ts imports Hugeicons; no lucide-react or @hugeicons/react", () => {
    expect(files.filter(({ r, imp }) => imp.some((s) => s.startsWith("@hugeicons/core-free-icons")) && r !== `${UI}ui/icons.ts`).map((f) => f.r))
      .toEqual([]);
    expect(files.filter(({ imp }) => imp.some((s) => s === "lucide-react" || s.startsWith("lucide-react/") || s.startsWith("@hugeicons/react")))
      .map((f) => f.r)).toEqual([]);
  });

  it("animate-pop and animate-swap are never prefixed with motion-safe: (the utility has its own reduced fade)", () => {
    expect(files.filter(({ src }) => /motion-safe:animate-(pop|swap)\b/.test(src)).map((f) => f.r)).toEqual([]);
  });

  it("features, ds and shell use motion tokens, never literal timings", () => {
    const bad = files.filter(({ r, src }) => (r.startsWith(`${WEB}features/`) || r.startsWith(`${WEB}components/shell/`) || r.startsWith(`${UI}ds/`))
      && /\b(duration|delay)-(\[|\d)|\banimation-duration:|\btransition-duration:\s*\d|["'`\s:]\d*\.?\d+m?s\b\s*(ease|linear|cubic|["'`;])/.test(src));
    expect(bad.map((f) => f.r)).toEqual([]);
  });

  it("no literal colour or arbitrary pixel class in .tsx", () => {
    const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|-\[\d+(?:\.\d+)?px\]/;
    const bad = files.filter(({ r, src }) => r.endsWith(".tsx") && LITERAL.test(strip(src)))
      .map(({ r, src }) => `${r}: ${strip(src).match(LITERAL)?.[0]}`);
    expect(bad).toEqual([]);
  });
});

/** The rules above are vacuous until shell, features and routes exist; these fixtures prove each checker bites. */
describe("architecture checkers (fixtures)", () => {
  const f = (r: string, src: string): F => ({ r, src, imp: [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!) });
  const route = (src: string, at = "users") => f(`${WEB}app/api/${at}/route.ts`, src);

  it("layer: shell importing a feature, ds importing charts", () => {
    expect(layerViolations([
      f(`${WEB}components/shell/nav.tsx`, `import { X } from "@/features/users/x";`),
      f(`${UI}ds/panel.tsx`, `import { Bar } from "../charts/bar-chart";`),
      f(`${WEB}features/users/page.tsx`, `import { Panel } from "@starterkit/ui/ds"; import { Nav } from "@/components/shell/nav";`),
    ])).toEqual([`${WEB}components/shell/nav.tsx → @/features/users/x`, `${UI}ds/panel.tsx → ../charts/bar-chart`]);
  });

  it("sibling feature via alias and relative path", () => {
    expect(siblingFeatureViolations([
      f(`${WEB}features/users/a.tsx`, `import { R } from "@/features/roles/r"; import { B } from "./b";`),
      f(`${WEB}features/users/c.tsx`, `import { A } from "../audit/a";`),
    ])).toEqual([`${WEB}features/users/a.tsx → @/features/roles/r`, `${WEB}features/users/c.tsx → ../audit/a`]);
  });

  it("client code importing lib/server", () => {
    expect(clientImportsServer([
      f(`${WEB}features/users/a.tsx`, `"use client";\nimport { db } from "@/lib/server/mock/db";`),
      f(`${WEB}features/users/b.tsx`, `import { db } from "@/lib/server/mock/db";`),
    ])).toEqual([`${WEB}features/users/a.tsx`]);
  });

  it("client fetch/api to an absolute, protocol-relative or ${base} URL; NEXT_PUBLIC API/URL env", () => {
    const bad = clientApiViolations([
      f(`${WEB}features/users/a.tsx`, `await fetch("https://backend.example/api/users"); await api<X>("//evil.example/x"); fetch(\`${"${BASE}"}/api/users\`); fetch('http://x');`),
      f(`${WEB}lib/client/b.ts`, `const u = process.env.NEXT_PUBLIC_API_BASE_URL; const v = process.env.NEXT_PUBLIC_SITE_NAME;`),
      f(`${WEB}app/x/c.tsx`, `"use client";\nfetch("http://x");`),
    ]);
    expect(bad).toHaveLength(6);
    expect(bad.filter((b) => b.includes("NEXT_PUBLIC_API_BASE_URL"))).toHaveLength(1);
    expect(bad.filter((b) => b.includes("SITE_NAME"))).toHaveLength(0);
  });

  it("client fetch/api to /api/ paths, variables, and server code pass", () => {
    expect(clientApiViolations([
      f(`${WEB}features/users/a.tsx`, `fetch("/api/users"); api<X>(\`/api/users/${"${id}"}\`); fetch(path); // fetch("http://x")`),
      f(`${WEB}lib/server/s.ts`, `fetch("https://backend.example/x"); process.env.NEXT_PUBLIC_API_URL;`),
    ])).toEqual([]);
  });

  it("a route handler without withPermission(", () => {
    expect(routeViolations([route(`export async function GET(req: Request) { return json(db().users); }`)]))
      .toEqual([`${WEB}app/api/users/route.ts GET: no withPermission(`]);
    expect(routeViolations([route(`// withPermission(\nexport async function GET() { return json(1); }`)]))
      .toEqual([`${WEB}app/api/users/route.ts GET: no withPermission(`]);
  });

  it("a mutation without recordActivity(, an arrow handler, a route with no handler", () => {
    const guarded = `export async function GET(req: Request) { return withPermission(req, "user.view", async () => json(1)); }\n`;
    expect(routeViolations([route(`${guarded}export async function DELETE(req: Request) { return withPermission(req, "user.delete", async () => json(1)); }`)]))
      .toEqual([`${WEB}app/api/users/route.ts DELETE: no recordActivity(`]);
    expect(routeViolations([route(`export const POST = async () => json(1);`)]))
      .toEqual([`${WEB}app/api/users/route.ts: export each handler as a function declaration`]);
    expect(routeViolations([route(`export const dynamic = "force-dynamic";`)])).toEqual([`${WEB}app/api/users/route.ts: no exported handler found`]);
  });

  it("a guarded GET next to an unguarded POST in one file: exactly the POST is reported", () => {
    const src = `export async function GET(req: Request) { return withPermission(req, "user.view", async () => json(1)); }
export async function POST(req: Request) { recordActivity(ctx, e); return json(1); }`;
    expect(routeViolations([route(src)])).toEqual([`${WEB}app/api/users/route.ts POST: no withPermission(`]);
  });

  it("guarded routes pass; app/api/auth/** is exempt", () => {
    const ok = `export async function PATCH(req: Request) { return withPermission(req, "user.edit", async (ctx) => { recordActivity(ctx, e); return json(1); }); }`;
    expect(routeViolations([route(ok), f(`${WEB}app/api/auth/login/route.ts`, `export async function POST() { return json(1); }`)])).toEqual([]);
  });
});
