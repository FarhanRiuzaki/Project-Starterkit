import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsOf, read, REPO, repoRel, scan, UI_SRC, WEB_SRC } from "./scan";

type F = { r: string; src: string; imp: string[] };

const WEB = "apps/web/src/";
const UI = "packages/ui/src/";
const files: F[] = scan([WEB_SRC, UI_SRC]).map((f) => ({ r: repoRel(f), src: read(f), imp: importsOf(f) }));
const cssFiles: F[] = scan([WEB_SRC, UI_SRC], /\.css$/).map((f) => ({ r: repoRel(f), src: read(f), imp: [] }));
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
 * Static limit: a `fetch(`/`api(` whose first argument is not a literal (fetch(url), fetch(BASE + "/x")) is NOT caught
 * here. The runtime guard in `lib/client/api.ts` covers `api()` calls only; a raw `fetch(` with a non-literal
 * argument is covered only by CSP connect-src 'self'. EventSource,
 * WebSocket and sendBeacon are stricter: a non-literal argument is flagged too.
 */
const isClient = ({ r, src }: F) => /^["']use client["']/m.test(src)
  || [`${WEB}features/`, `${WEB}components/`, `${WEB}lib/client/`].some((p) => r.startsWith(p));
function clientApiViolations(fs: F[]): string[] {
  return fs.filter(isClient).flatMap(({ r, src: raw }) => {
    // Comments only: a "//" inside a string ("https://…") must not swallow the rest of the line.
    const src = raw.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "$1");
    // First argument written as a string or template literal must start with "/api/" (not http(s)://, //, a ${base}).
    const calls = [...src.matchAll(/\b(fetch|api)\s*(?:<[^<>()]*>)?\(\s*(["'`])(?=([^]{0,12}))/g)]
      .filter((m) => !m[3]!.startsWith("/api/")).map((m) => `${r}: ${m[1]}(${m[2]}${m[3]!.split(m[2]!)[0]}…) must start with "/api/"`);
    const streams = [...src.matchAll(/(new\s+(?:EventSource|WebSocket)|navigator\.sendBeacon)\s*\(\s*(["'`]?)(?=([^]{0,12}))/g)]
      .filter((m) => !(m[2] && m[3]!.startsWith("/api/"))).map((m) => `${r}: ${m[1]}( must take a literal starting with "/api/"`);
    const env = [...src.matchAll(/process\.env\.NEXT_PUBLIC_\w*(?:API|URL)\w*/g)].map((m) => `${r}: ${m[0]} exposes a backend URL to the browser`);
    return [...calls, ...streams, ...env];
  });
}

/** `import { type A, type B }`: every named import is type-only. */
const allTypes = (clause: string | undefined) => {
  const c = clause?.trim() ?? "";
  return /^\{[\s\S]*\}$/.test(c) && c.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).every((x) => x.startsWith("type "));
};
/**
 * Browser code takes the zod contracts (and zod itself) as types only, so zod stays out of every route's first load
 * (ui-standard §5). Value lists the screens need live in zod-free lib/shared modules.
 */
function clientZodViolations(fs: F[]): string[] {
  return fs.filter(isClient).flatMap(({ r, src }) => [...strip(src).matchAll(/^\s*import\s+(type\s+)?(?:([^;"']*?)\s+from\s+)?["']([^"']+)["']/gm)]
    .filter((m) => {
      const spec = m[3]!;
      return spec === "zod" || spec.startsWith("zod/") || !!resolveSpec(r, spec)?.startsWith(`${WEB}lib/shared/contracts/`);
    })
    .filter((m) => !m[1] && !allTypes(m[2]))
    .map((m) => `${r}: value import from ${m[3]}`));
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

const ROUTE = new RegExp(`^${WEB}app/api/(.+/)?route\\.tsx?$`);

/**
 * GET routes that answer one record, a summary or a redirect, not a list; every other GET pages with paginate(
 * (spec "Standar tabel & skalabilitas": no list endpoint without a bound). Keys are paths under app/api/.
 */
const NON_LIST_GETS: Record<string, string> = {
  "auth/oauth/[provider]/route.ts": "redirect to the provider",
  "dashboard/route.ts": "summary numbers; its recent list is fixed at 5",
  "me/route.ts": "the signed-in user",
  "roles/[id]/route.ts": "one role",
  "users/[id]/route.ts": "one user; its recent activity is fixed at 20",
  // ponytail: role names for the filter and the user form; switch to a searchable picker on /api/roles?q= if roles grow past a few hundred.
  "users/roles/route.ts": "role names for selects",
};

/** A GET route not in `allow` must call paginate( in its GET handler; an `allow` entry must name a route that has a GET. */
function listGetViolations(fs: F[], allow: Record<string, string> = NON_LIST_GETS): string[] {
  const gets = fs.filter(({ r }) => ROUTE.test(r)).flatMap(({ r, src }) => {
    const get = handlers(strip(src)).find((h) => h.method === "GET");
    return get ? [{ key: r.slice(`${WEB}app/api/`.length), body: get.body }] : [];
  });
  return [
    ...gets.filter((g) => !(g.key in allow) && !/\bpaginate\(/.test(g.body)).map((g) => `app/api/${g.key}: GET answers a list without paginate(`),
    ...Object.keys(allow).filter((k) => !gets.some((g) => g.key === k)).map((k) => `app/api/${k}: listed as a non-list GET but has no GET handler`),
  ];
}

const MOTION_TOKENS = `${UI}motion/tokens.ts`;
/** Literal timings in TS/TSX (motion values come from motion/tokens.ts or the CSS --dur-* / --ease-* tokens). */
const TS_TIMING: RegExp[] = [
  /\b(?:duration|delay)-(?:\[|\d)/, // Tailwind duration-150, delay-[40ms]
  /\bease-\[/, // ease-[cubic-bezier(…)]
  /\b(?:duration|delay)\s*:\s*\d/, // { duration: 0.2 }
  /\bease\s*:\s*\[/, // { ease: [0.2, 0, 0, 1] }
  /\bcubic-bezier\(/,
  /\b(?:stiffness|damping)\s*:\s*\d/, // inline spring
  /\b(?:animation|transition)(?:Delay|Duration)\s*:[^,;\n]*\d/, // animationDelay: `${i * 12}ms`
  /["'`\s:]\d*\.?\d+m?s\b\s*(?:ease|linear|cubic|["'`;])/, // "200ms", "0.2s ease"
];
/** CSS: a time other than 0 or a cubic-bezier( outside a custom-property definition (`--dur-x: 150ms`). */
const CSS_TIMING = /(?<![\w.-])(?!0m?s\b)\d*\.?\d+m?s\b|\bcubic-bezier\(/;

function motionLiteralViolations(ts: F[], css: F[]): string[] {
  const inTs = ts.filter(({ r }) => r !== MOTION_TOKENS).flatMap(({ r, src }) => {
    const hit = TS_TIMING.map((re) => strip(src).match(re)?.[0]).find(Boolean);
    return hit ? [`${r}: ${hit}`] : [];
  });
  const inCss = css.flatMap(({ r, src }) => src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n")
    .flatMap((line) => line.split(";")).map((d) => d.slice(d.lastIndexOf("{") + 1)).filter((d) => !/^\s*--[\w-]+\s*:/.test(d))
    .flatMap((d) => { const m = d.match(CSS_TIMING); return m ? [`${r}: ${m[0]}`] : []; }));
  return [...inTs, ...inCss];
}

/** Status legends live in a card header (Panel `legend`), never on a page, toolbar or inline (spec "Legend status per card"). */
const LEGEND_HOME = `${UI}ds/panel.tsx`;
function legendViolations(fs: F[]): string[] {
  return fs.filter(({ r, src }) => r !== LEGEND_HOME && /<StatusLegend\b/.test(strip(src))).map(({ r }) => `${r}: renders StatusLegend; pass Panel legend instead`);
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

  it("client code imports zod contracts and zod as types only", () => {
    expect(clientZodViolations(files)).toEqual([]);
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

  it("motion timings come from tokens: no literal duration, delay, easing or spring outside motion/tokens.ts and CSS token definitions", () => {
    expect(motionLiteralViolations(files, cssFiles)).toEqual([]);
  });

  it("every GET route that answers a list pages it with paginate(; the non-list allowlist is exact", () => {
    expect(listGetViolations(files)).toEqual([]);
  });

  it("StatusLegend is rendered only by Panel (per-card legend)", () => {
    expect(legendViolations(files)).toEqual([]);
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

  it("client EventSource, WebSocket, sendBeacon: absolute URL or non-literal argument", () => {
    expect(clientApiViolations([
      f(`${WEB}features/x/a.tsx`, `new EventSource("https://x.example/e"); new WebSocket(url); navigator.sendBeacon(endpoint, d); new EventSource("/api/stream");`),
    ])).toEqual([
      `${WEB}features/x/a.tsx: new EventSource( must take a literal starting with "/api/"`,
      `${WEB}features/x/a.tsx: new WebSocket( must take a literal starting with "/api/"`,
      `${WEB}features/x/a.tsx: navigator.sendBeacon( must take a literal starting with "/api/"`,
    ]);
  });

  it("client fetch/api to /api/ paths, variables, and server code pass", () => {
    expect(clientApiViolations([
      f(`${WEB}features/users/a.tsx`, `fetch("/api/users"); api<X>(\`/api/users/${"${id}"}\`); fetch(path); // fetch("http://x")`),
      f(`${WEB}lib/server/s.ts`, `fetch("https://backend.example/x"); process.env.NEXT_PUBLIC_API_URL;`),
    ])).toEqual([]);
  });

  it("client value import of a contract or zod; type-only imports and server code pass", () => {
    expect(clientZodViolations([
      f(`${WEB}features/x/a.tsx`, `import { AUTH_EVENTS } from "@/lib/shared/contracts/audit";\nimport { type Page, ListQuery } from "@/lib/shared/contracts/common";`),
      f(`${WEB}lib/client/b.ts`, `import { z } from "zod";\nimport "zod/v4/core";`),
      f(`${WEB}app/x/c.tsx`, `"use client";\nimport { UserDto } from "../../lib/shared/contracts/users";`),
      f(`${WEB}features/x/ok.tsx`, `import type { Page } from "@/lib/shared/contracts/common";\nimport { type UserDto, type X } from "@/lib/shared/contracts/users";\nimport { AUTH_EVENTS } from "@/lib/shared/audit";`),
      f(`${WEB}lib/server/s.ts`, `import { ListQuery } from "@/lib/shared/contracts/common";\nimport { z } from "zod";`),
    ])).toEqual([
      `${WEB}features/x/a.tsx: value import from @/lib/shared/contracts/audit`,
      `${WEB}features/x/a.tsx: value import from @/lib/shared/contracts/common`,
      `${WEB}lib/client/b.ts: value import from zod`,
      `${WEB}lib/client/b.ts: value import from zod/v4/core`,
      `${WEB}app/x/c.tsx: value import from ../../lib/shared/contracts/users`,
    ]);
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

  it("zod import check: a side-effect import followed by a type-only contract import passes", () => {
    expect(clientZodViolations([
      f(`${WEB}features/x/a.tsx`, `import "./x.css";\nimport type { A } from "@/lib/shared/contracts/audit";`),
    ])).toEqual([]);
  });

  it("list GET without paginate(, allowlisted and paged GETs pass, a stale allowlist entry is reported", () => {
    const guarded = (inner: string) => `export async function GET(req: Request) { return withPermission(req, "user.view", async () => ${inner}); }`;
    expect(listGetViolations([
      route(guarded("json([...db().users.values()])"), "users"),
      route(guarded("json(paginate(rows, q, SORTERS, \"name\"))"), "roles"),
      route(guarded("json(db().users.get(id))"), "users/[id]"),
      route(`export async function POST(req: Request) { return withPermission(req, "x", async () => json([])); }`, "bulk"),
      route(guarded("json(rows) // paginate( only in a comment"), "logs"),
    ], { "users/[id]/route.ts": "one user", "gone/route.ts": "removed route" })).toEqual([
      "app/api/users/route.ts: GET answers a list without paginate(",
      "app/api/logs/route.ts: GET answers a list without paginate(",
      "app/api/gone/route.ts: listed as a non-list GET but has no GET handler",
    ]);
  });

  it("motion literals in TS/TSX and CSS; tokens, token definitions and 0ms pass", () => {
    const bad = motionLiteralViolations([
      f(`${UI}ui/a.tsx`, `<div className="transition-opacity duration-200" />`),
      f(`${UI}ui/b.tsx`, `animate(el, { x: 0 }, { duration: 0.2 });`),
      f(`${UI}ui/c.tsx`, `const t = { ease: [0.2, 0, 0, 1] };`),
      f(`${UI}ui/d.tsx`, `style={{ transition: "opacity 200ms ease" }}`),
      f(`${UI}ui/e.tsx`, `const s = { type: "spring", stiffness: 420 };`),
      f(`${UI}charts/f.tsx`, "const m = { animationDelay: `${Math.min(200, i * 12)}ms` };"),
      f(`${WEB}features/g.tsx`, `const e = "cubic-bezier(0.2, 0, 0, 1)";`),
      f(`${UI}ui/ok.tsx`, "<div className=\"duration-(--dur-fast)\" style={{ animationDelay: `${staggerDelay(i)}s` }} /> // duration-200 in a comment"),
      f(MOTION_TOKENS, `export const DUR = { fast: 0.15 }; export const EASE = { out: [0.22, 1, 0.36, 1] };`),
    ], [
      f(`${UI}styles/x.css`, `.a { transition: opacity 150ms linear; }\n.b { animation-delay: 35ms; }\n.c { animation: s 1.2s linear infinite; }\n.d { transition-timing-function: cubic-bezier(0, 0, 1, 1); }`),
      f(`${UI}styles/ok.css`, `:root { --dur-fast: 150ms; --ease-out: cubic-bezier(0.22, 1, 0.36, 1); }\n.e { animation-delay: 0ms; height: 100svh; transition: opacity var(--dur-fast) var(--ease-out); } /* 200ms */`),
    ]);
    expect(bad).toEqual([
      `${UI}ui/a.tsx: duration-2`, `${UI}ui/b.tsx: duration: 0`, `${UI}ui/c.tsx: ease: [`, `${UI}ui/d.tsx:  200ms ease`,
      `${UI}ui/e.tsx: stiffness: 4`, `${UI}charts/f.tsx: animationDelay: \`\${Math.min(200`, `${WEB}features/g.tsx: cubic-bezier(`,
      `${UI}styles/x.css: 150ms`, `${UI}styles/x.css: 35ms`, `${UI}styles/x.css: 1.2s`, `${UI}styles/x.css: cubic-bezier(`,
    ]);
  });

  it("StatusLegend outside Panel (page header, toolbar, gallery) is reported; Panel and StatusLegendList pass", () => {
    expect(legendViolations([
      f(`${WEB}features/users/page.tsx`, `<Toolbar end={<StatusLegend items={LEGEND} />} />`),
      f(`${WEB}features/ds/gallery.tsx`, `<PageHeader actions={<StatusLegend items={L} />} />`),
      f(LEGEND_HOME, `{legend && <StatusLegend items={legend} />}`),
      f(`${UI}ds/status-legend.tsx`, `<StatusLegendList items={items} />`),
      f(`${WEB}features/audit/x.tsx`, `<Panel legend={LEGEND} /> // <StatusLegend items={x} />`),
    ])).toEqual([
      `${WEB}features/users/page.tsx: renders StatusLegend; pass Panel legend instead`,
      `${WEB}features/ds/gallery.tsx: renders StatusLegend; pass Panel legend instead`,
    ]);
  });
});
