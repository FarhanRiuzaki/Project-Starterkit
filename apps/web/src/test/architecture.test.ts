import path from "node:path";
import { describe, expect, it } from "vitest";
import { pagePerm } from "@/lib/shared/nav";
import { BRAND } from "@starterkit/shared/brand";
import { importsIn, importsOf, read, REPO, repoRel, scan, SHARED_SRC, strip, UI_SRC, WEB_SRC } from "./scan";

type F = { r: string; src: string; imp: string[] };

const WEB = "apps/web/src/";
const UI = "packages/ui/src/";
const SHARED = "packages/shared/src/";
const files: F[] = scan([WEB_SRC, UI_SRC, SHARED_SRC]).map((f) => ({ r: repoRel(f), src: read(f), imp: importsOf(f) }));
const cssFiles: F[] = scan([WEB_SRC, UI_SRC], /\.css$/).map((f) => ({ r: repoRel(f), src: read(f), imp: [] }));

/** ui/motion/lib = primitives (0) → ds (1) → charts (2) → shell (3) → features (4). */
const layer = (r: string) =>
  [`${UI}ui/`, `${UI}motion/`, `${UI}lib/`].some((p) => r.startsWith(p)) ? 0 : r.startsWith(`${UI}ds/`) ? 1
    : r.startsWith(`${UI}charts/`) ? 2 : r.startsWith(`${WEB}components/shell/`) ? 3 : r.startsWith(`${WEB}features/`) ? 4 : null;
/** Import specifier → repo-relative path ("@/x", "@starterkit/ui/x", "./x" all resolve); other packages → null. */
const resolveSpec = (fromRel: string, spec: string): string | null =>
  spec.startsWith("@/") ? WEB + spec.slice(2)
    : spec.startsWith("@starterkit/shared/") ? SHARED + spec.slice("@starterkit/shared/".length)
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

/** packages/shared/src stays pure: no React, Next, apps/, the @/ alias; the only @starterkit import is @starterkit/ui/lib/*. */
function sharedViolations(fs: F[]): string[] {
  const bad = (s: string) => /^(react|next)(\/|$)/.test(s) || s.startsWith("@/") || /(^|\/)apps\//.test(s)
    || (s.startsWith("@starterkit/") && !s.startsWith("@starterkit/ui/lib/"));
  return fs.filter(({ r }) => r.startsWith(SHARED)).flatMap(({ r, imp }) => imp.filter(bad).map((s) => `${r} → ${s}`));
}

/** sonner (~10 kB gz) loads on demand: `toast` from ui/toast.ts, the Toaster through next/dynamic (providers.tsx). */
function sonnerViolations(fs: F[]): string[] {
  const own = [`${UI}ui/sonner.tsx`, `${UI}ui/toast.ts`];
  return fs.filter(({ r, src, imp }) => (imp.includes("sonner") && !own.includes(r)) || /from\s+["']@starterkit\/ui\/ui\/sonner["']/.test(src)).map((f) => f.r);
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
    // Comments only (string-aware strip): a "//" inside a string ("https://…") must not swallow the rest of the line.
    const src = strip(raw);
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
      return spec === "zod" || spec.startsWith("zod/") || !!resolveSpec(r, spec)?.startsWith(`${SHARED}contracts/`);
    })
    .filter((m) => !m[1] && !allTypes(m[2]))
    .map((m) => `${r}: value import from ${m[3]}`));
}

/**
 * The web reaches the API over HTTP only (lib/server/backend.ts): nothing under apps/web/src imports the Bun runtime
 * (`bun`, `bun:*`), a database driver (`pg`) or API code (`@starterkit/api`, a path into apps/api).
 */
function runtimeViolations(fs: F[]): string[] {
  const bad = (r: string, s: string) => /^(bun|pg)$|^bun:|^pg\//.test(s) || s.startsWith("@starterkit/api")
    || /(^|\/)apps\/api(\/|$)/.test(s) || !!resolveSpec(r, s)?.startsWith("apps/api/");
  return fs.filter(({ r }) => r.startsWith(WEB)).flatMap(({ r, imp }) => imp.filter((s) => bad(r, s)).map((s) => `${r} → ${s}`));
}

/**
 * Route handlers: the catch-all that forwards to the API, and the auth routes that set the cookie. Guards, CSRF order
 * and activity entries of every other endpoint live in the API (apps/api/test/architecture/conformance.test.ts).
 */
const ROUTE_FILES = [
  "app/api/[...path]/route.ts", "app/api/auth/2fa/route.ts", "app/api/auth/forgot/route.ts", "app/api/auth/login/route.ts",
  "app/api/auth/logout/route.ts", "app/api/auth/oauth/[provider]/callback/route.ts", "app/api/auth/oauth/[provider]/mock-authorize/route.ts",
  "app/api/auth/oauth/[provider]/route.ts", "app/api/auth/reset/route.ts",
].map((r) => WEB + r);
const routeFiles = (fs: F[]) => fs.filter(({ r }) => new RegExp(`^${WEB}app/(.+/)?route\\.tsx?$`).test(r)).map(({ r }) => r).sort();

const MOTION_TOKENS = `${UI}motion/tokens.ts`;
/** Literal timings in TS/TSX (motion values come from motion/tokens.ts or the CSS --dur-* / --ease-* tokens). */
const TS_TIMING: RegExp[] = [
  /\b(?:duration|delay)-(?:\[|\d)/, // Tailwind duration-150, delay-[40ms]
  /\bease-\[/, // ease-[cubic-bezier(…)]
  /\b(?:duration|delay)\s*:\s*\d/, // { duration: 0.2 }
  /\bease\s*:\s*\[/, // { ease: [0.2, 0, 0, 1] }
  /\bcubic-bezier\(/,
  /\bease\s*:\s*["'`]/, // { ease: "linear" }
  /\b(?:stiffness|damping|bounce)\s*:\s*\d/, // inline spring
  /\b(?:DUR|STAGGER|CHART_STAGGER)\.\w+\s*[-+]\s*\d|\d\s*[-+]\s*(?:DUR|STAGGER|CHART_STAGGER)\.\w+/, // DUR.slow + 0.32
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

/** A list screen (useTableQuery) gives its viewer the column chooser and passes the choice to its DataTable. */
function columnsMenuViolations(fs: F[]): string[] {
  return fs.filter(({ r, src }) => r.startsWith(`${WEB}features/`) && /\buseTableQuery\(/.test(strip(src)))
    .filter(({ src }) => { const code = strip(src); return !/<ColumnsMenu\b[^>]*hidden=/.test(code) || !/<DataTable\b[^>]*\bhidden=/.test(code); })
    .map(({ r }) => `${r}: a list screen renders ColumnsMenu and passes hidden to DataTable`);
}

/** The product name is one constant (BRAND in packages/shared/src/brand.ts); titles, error sources and the logo read it. */
const BRAND_HOME = `${SHARED}brand.ts`;
const NAME = new RegExp(`\\b${BRAND.name}\\b`);
const brandViolations = (fs: F[]) => fs.filter(({ r, src }) => r !== BRAND_HOME && NAME.test(src)).map(({ r }) => `${r}: write BRAND.name, not the product name`);

/** Each signed-in page.tsx guards with the permission pagePerm gives its path (the layout's 404 check uses pagePerm). */
function pageGuardViolations(fs: F[]): string[] {
  return fs.filter(({ r }) => r.startsWith(`${WEB}app/(main)/`) && r.endsWith("/page.tsx")).flatMap(({ r, src }) => {
    const route = r.slice(`${WEB}app/(main)`.length, -"/page.tsx".length).replace(/\[\w+\]/g, "x") || "/";
    const arg = strip(src).match(/requirePagePermission\(\s*(null|"[^"]+")?\s*\)/)?.[1];
    const own = arg && arg !== "null" ? arg.slice(1, -1) : null;
    return own === pagePerm(route) ? [] : [`${r}: guards with ${own ?? "nothing"}, pagePerm("${route}") is ${pagePerm(route) ?? "null"}`];
  });
}

/** The app time zone is written only in packages/ui/src/lib/format.ts (packages/ui time-zone.test.ts checks the package). */
const ZONE_LITERAL = /7\s*\*\s*(?:3600|60\s*\*\s*60)|25_?200|["'`>(\s]WIB\b|\bUTC\s*\+\s*7\b|\w+WIB\b/;
const zoneViolations = (fs: F[]) => fs.filter(({ r, src }) => r.startsWith(WEB) && ZONE_LITERAL.test(strip(src))).map(({ r }) => r);

/** Password fields are PasswordInput (show/hide, Caps Lock note, paste works): no raw type="password" elsewhere. */
const PASSWORD_HOME = `${UI}ui/password-input.tsx`;
const RAW_PASSWORD = /\btype=(?:"password"|'password'|\{[^}]*["']password["'][^}]*\})/;
const passwordFieldViolations = (fs: F[]) => fs.filter(({ r, src }) => r !== PASSWORD_HOME && r.endsWith(".tsx") && RAW_PASSWORD.test(strip(src)))
  .map(({ r }) => `${r}: a raw password input; use PasswordInput`);
/** A new-password field lists its requirements while the user types (PasswordChecks + passwordChecks()). */
const newPasswordViolations = (fs: F[]) => fs.filter(({ r, src }) => r.startsWith(WEB) && /autoComplete=["']new-password["']/.test(src) && !/<PasswordChecks\b/.test(strip(src)))
  .map(({ r }) => `${r}: a new-password field without PasswordChecks`);

/**
 * Inner scroll areas use the quiet scrollbar (base.css `scroll-quiet`), or none with ScrollArea's own thumb
 * (`scroll-none`): a class string with overflow-*-auto names one of them too.
 */
const OVERFLOW_AUTO = /\boverflow(?:-[xy])?-auto\b/;
const scrollViolations = (fs: F[]) => fs.filter(({ r }) => r.endsWith(".tsx")).flatMap(({ r, src }) =>
  [...strip(src).matchAll(/"[^"\n]*"|`[^`]*`/g)].map((m) => m[0]).filter((c) => OVERFLOW_AUTO.test(c) && !/\bscroll-(?:quiet|none)\b/.test(c))
    .map((c) => `${r}: ${c.match(OVERFLOW_AUTO)![0]} without scroll-quiet`));

describe("architecture", () => {
  it("inner scroll areas use the quiet scrollbar (scroll-quiet next to overflow-*-auto)", () => {
    expect(scrollViolations(files)).toEqual([]);
  });

  it("password fields are PasswordInput; a new-password field shows PasswordChecks", () => {
    expect(passwordFieldViolations(files)).toEqual([]);
    expect(newPasswordViolations(files)).toEqual([]);
  });

  it("apps/web writes no UTC offset or zone label (APP_UTC_OFFSET_SEC, APP_TIME_ZONE_LABEL, formatDate…)", () => {
    expect(zoneViolations(files)).toEqual([]);
  });

  it("each signed-in page guards with the permission pagePerm gives its path", () => {
    expect(pageGuardViolations(files)).toEqual([]);
  });

  it("the product name appears only in packages/shared/src/brand.ts", () => {
    expect(brandViolations(files)).toEqual([]);
  });

  it("layers import downward only (ui/motion → ds → charts → components/shell → features)", () => {
    expect(layerViolations(files)).toEqual([]);
  });

  it("a feature never imports a sibling feature (alias or relative path)", () => {
    expect(siblingFeatureViolations(files)).toEqual([]);
  });

  it("no Bun runtime, database driver or API code in apps/web/src", () => {
    expect(runtimeViolations(files)).toEqual([]);
  });

  it("route.ts files are exactly the catch-all and the auth routes", () => {
    expect(routeFiles(files)).toEqual([...ROUTE_FILES].sort());
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

  it("packages/shared is pure (no React, Next, apps/, @/; only @starterkit/ui/lib/*)", () => {
    expect(sharedViolations(files)).toEqual([]);
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

  it("sonner stays out of first loads: only ui/sonner.tsx and ui/toast.ts import it; ui/sonner only through import()", () => {
    expect(sonnerViolations(files)).toEqual([]);
    expect(sonnerViolations([
      { r: `${WEB}features/x/a.tsx`, src: `import { toast } from "sonner";`, imp: ["sonner"] },
      { r: `${WEB}features/x/b.tsx`, src: `import { Toaster } from "@starterkit/ui/ui/sonner";`, imp: ["@starterkit/ui/ui/sonner"] },
      { r: `${WEB}components/c.tsx`, src: `dynamic(() => import("@starterkit/ui/ui/sonner"))`, imp: ["@starterkit/ui/ui/sonner"] },
    ])).toEqual([`${WEB}features/x/a.tsx`, `${WEB}features/x/b.tsx`]);
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

  it("every list screen has the column chooser (ColumnsMenu + DataTable hidden)", () => {
    expect(columnsMenuViolations(files)).toEqual([]);
  });

  it("StatusLegend is rendered only by Panel (per-card legend)", () => {
    expect(legendViolations(files)).toEqual([]);
  });

  it("app motion is wired once: (main)/layout.tsx wraps the page in MotionLayer + PageTransitionRoot, (main)/template.tsx renders PageTransition", () => {
    const src = (r: string) => strip(files.find((f) => f.r === r)?.src ?? "");
    expect(src(`${WEB}app/(main)/layout.tsx`)).toMatch(/<MotionLayer>[\s\S]*<PageTransitionRoot>\{children\}<\/PageTransitionRoot>[\s\S]*<\/MotionLayer>/);
    expect(src(`${WEB}app/(main)/template.tsx`)).toMatch(/<PageTransition>\{children\}<\/PageTransition>/);
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
      f(`${WEB}features/users/a.tsx`, `"use client";\nimport { getSession } from "@/lib/server/session";`),
      f(`${WEB}features/users/b.tsx`, `import { getSession } from "@/lib/server/session";`),
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
      f(`${WEB}features/x/a.tsx`, `import { AUTH_EVENTS } from "@starterkit/shared/contracts/audit";\nimport { type Page, ListQuery } from "@starterkit/shared/contracts/common";`),
      f(`${WEB}lib/client/b.ts`, `import { z } from "zod";\nimport "zod/v4/core";`),
      f(`${WEB}app/x/c.tsx`, `"use client";\nimport { UserDto } from "@starterkit/shared/contracts/users";`),
      f(`${WEB}features/x/ok.tsx`, `import type { Page } from "@starterkit/shared/contracts/common";\nimport { type UserDto, type X } from "@starterkit/shared/contracts/users";\nimport { AUTH_EVENTS } from "@starterkit/shared/audit";`),
      f(`${WEB}lib/server/s.ts`, `import { ListQuery } from "@starterkit/shared/contracts/common";\nimport { z } from "zod";`),
    ])).toEqual([
      `${WEB}features/x/a.tsx: value import from @starterkit/shared/contracts/audit`,
      `${WEB}features/x/a.tsx: value import from @starterkit/shared/contracts/common`,
      `${WEB}lib/client/b.ts: value import from zod`,
      `${WEB}lib/client/b.ts: value import from zod/v4/core`,
      `${WEB}app/x/c.tsx: value import from @starterkit/shared/contracts/users`,
    ]);
  });

  it("shared fixtures: React, Next, app paths, @/ and other @starterkit packages are caught; ui/lib and relative pass", () => {
    const f = (r: string, src: string): F => ({ r, src, imp: importsIn(src) });
    expect(sharedViolations([
      f(`${SHARED}a.ts`, `import { useState } from "react";\nimport { x } from "next/headers";`),
      f(`${SHARED}b.ts`, `import { y } from "@/lib/server/x";\nimport { z } from "../../../apps/web/src/y";`),
      f(`${SHARED}c.ts`, `import { w } from "@starterkit/ui/ds";\nimport { v } from "@starterkit/ui/ui/button";`),
      f(`${SHARED}ok.ts`, `import { appDate } from "@starterkit/ui/lib/format";\nimport { a } from "./contracts/audit";\nimport { z } from "zod";`),
    ])).toEqual([
      `${SHARED}a.ts → react`, `${SHARED}a.ts → next/headers`,
      `${SHARED}b.ts → @/lib/server/x`, `${SHARED}b.ts → ../../../apps/web/src/y`,
      `${SHARED}c.ts → @starterkit/ui/ds`, `${SHARED}c.ts → @starterkit/ui/ui/button`,
    ]);
  });

  it("runtime imports: bun, bun:sqlite, pg, @starterkit/api and paths into apps/api are caught; node: and packages pass", () => {
    const g = (r: string, src: string): F => ({ r, src, imp: importsIn(src) });
    expect(runtimeViolations([
      g(`${WEB}lib/server/a.ts`, `import { SQL } from "bun";\nimport { Database } from "bun:sqlite";\nimport { Pool } from "pg";`),
      g(`${WEB}lib/server/b.ts`, `import { createApp } from "@starterkit/api/app";\nimport { sql } from "../../../../api/src/db/client";`),
      g(`${WEB}lib/server/ok.ts`, `import { randomUUID } from "node:crypto";\nimport { z } from "zod";\nimport { BRAND } from "@starterkit/shared/brand";\nimport x from "bunyan";`),
      g(`${UI}lib/c.ts`, `import { SQL } from "bun";`),
    ])).toEqual([
      `${WEB}lib/server/a.ts → bun`, `${WEB}lib/server/a.ts → bun:sqlite`, `${WEB}lib/server/a.ts → pg`,
      `${WEB}lib/server/b.ts → @starterkit/api/app`, `${WEB}lib/server/b.ts → ../../../../api/src/db/client`,
    ]);
  });

  it("route files: an extra route.ts under app/ (api or not) shows up in the list", () => {
    const g = (r: string): F => ({ r: WEB + r, src: "", imp: [] });
    expect(routeFiles([g("app/api/users/route.ts"), g("app/(main)/export/route.ts"), g("app/api/[...path]/route.ts"), g("app/(main)/page.tsx")]))
      .toEqual([`${WEB}app/(main)/export/route.ts`, `${WEB}app/api/[...path]/route.ts`, `${WEB}app/api/users/route.ts`]);
  });

  it("strip() removes comments but keeps strings, templates and regex literals whole", () => {
    expect(strip(`const u = "https://x"; // note\nconst r = /\\/\\/.*$/g; /* block */ const t = \`a // b\`;`))
      .toBe(`const u = "https://x"; \nconst r = /\\/\\/.*$/g;  const t = \`a // b\`;`);
    expect(strip(`const q = "it's"; x = a / b; // c`)).toBe(`const q = "it's"; x = a / b; `);
    expect(strip(`const re = /["']/; y(); // z`)).toBe(`const re = /["']/; y(); `);
    expect(strip(`<Panel legend={L} /> // <StatusLegend />`)).toBe(`<Panel legend={L} /> `);
  });

  it("client-API rule: a comment right after code is ignored, a URL with // in a string still checked", () => {
    expect(clientApiViolations([
      f(`${WEB}features/x/a.tsx`, `fetch("/api/x");// fetch("http://x")\nconst s = "a //b"; fetch("https://evil.example/x");`),
    ])).toEqual([`${WEB}features/x/a.tsx: fetch("https://evil…) must start with "/api/"`]);
  });

  it("zod import check: a side-effect import followed by a type-only contract import passes", () => {
    expect(clientZodViolations([
      f(`${WEB}features/x/a.tsx`, `import "./x.css";\nimport type { A } from "@starterkit/shared/contracts/audit";`),
    ])).toEqual([]);
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
      f(`${UI}motion/h.tsx`, `const t = { duration: DUR.instant, ease: "linear" };`),
      f(`${UI}motion/i.tsx`, `animate(0, 1, { type: "spring", bounce: 0 });`),
      f(`${UI}charts/j.ts`, `const SETTLE_MS = Math.round((DUR.slow + 0.32) * 1000);`),
      f(`${UI}charts/k.ts`, `const d = 0.05 + STAGGER.step;`),
      f(`${UI}charts/ok2.ts`, `const a = DUR.enter * 1000; const b = Math.max(DUR.slow + CHART_STAGGER.max, DUR.draw); animate(0, 1, { ...SPRING_TWEEN, duration: s, ease: EASE.linear });`),
      f(`${UI}ui/ok.tsx`, "<div className=\"duration-(--dur-fast)\" style={{ animationDelay: `${staggerDelay(i)}s` }} /> // duration-200 in a comment"),
      f(MOTION_TOKENS, `export const DUR = { fast: 0.15 }; export const EASE = { out: [0.22, 1, 0.36, 1] };`),
    ], [
      f(`${UI}styles/x.css`, `.a { transition: opacity 150ms linear; }\n.b { animation-delay: 35ms; }\n.c { animation: s 1.2s linear infinite; }\n.d { transition-timing-function: cubic-bezier(0, 0, 1, 1); }`),
      f(`${UI}styles/ok.css`, `:root { --dur-fast: 150ms; --ease-out: cubic-bezier(0.22, 1, 0.36, 1); }\n.e { animation-delay: 0ms; height: 100svh; transition: opacity var(--dur-fast) var(--ease-out); } /* 200ms */`),
    ]);
    expect(bad).toEqual([
      `${UI}ui/a.tsx: duration-2`, `${UI}ui/b.tsx: duration: 0`, `${UI}ui/c.tsx: ease: [`, `${UI}ui/d.tsx:  200ms ease`,
      `${UI}ui/e.tsx: stiffness: 4`, `${UI}charts/f.tsx: animationDelay: \`\${Math.min(200`, `${WEB}features/g.tsx: cubic-bezier(`,
      `${UI}motion/h.tsx: ease: "`, `${UI}motion/i.tsx: bounce: 0`, `${UI}charts/j.ts: DUR.slow + 0`, `${UI}charts/k.ts: 5 + STAGGER.step`,
      `${UI}styles/x.css: 150ms`, `${UI}styles/x.css: 35ms`, `${UI}styles/x.css: 1.2s`, `${UI}styles/x.css: cubic-bezier(`,
    ]);
  });

  it("a zone literal in apps/web is reported", () => {
    expect(zoneViolations([f(`${WEB}features/x/a.tsx`, "const t = `${formatTime(at)} WIB`;"), f(`${WEB}features/x/b.tsx`, `formatTime(at); // 14:00 WIB`)]))
      .toEqual([`${WEB}features/x/a.tsx`]);
  });

  it("a page guard that differs from pagePerm is reported", () => {
    expect(pageGuardViolations([
      f(`${WEB}app/(main)/roles/page.tsx`, `await requirePagePermission("user.view");`),
      f(`${WEB}app/(main)/users/new/page.tsx`, `await requirePagePermission("user.create");`),
      f(`${WEB}app/(main)/audit/auth/page.tsx`, `export default function P() {}`),
    ])).toEqual([
      `${WEB}app/(main)/roles/page.tsx: guards with user.view, pagePerm("/roles") is role.view`,
      `${WEB}app/(main)/audit/auth/page.tsx: guards with nothing, pagePerm("/audit/auth") is audit.view`,
    ]);
  });

  it("overflow-*-auto without scroll-quiet is reported; with it, or overflow-hidden, passes", () => {
    expect(scrollViolations([
      f(`${UI}ui/a.tsx`, `<div className="max-h-80 overflow-y-auto" />`),
      f(`${WEB}features/x/b.tsx`, "<div className={`grid ${x} overflow-x-auto`} />"),
      f(`${UI}ui/ok.tsx`, `<div className="scroll-quiet overflow-auto" /><div className="overflow-hidden" />`),
    ])).toEqual([`${UI}ui/a.tsx: overflow-y-auto without scroll-quiet`, `${WEB}features/x/b.tsx: overflow-x-auto without scroll-quiet`]);
  });

  it("a raw password input and a new-password field without its checklist are reported; PasswordInput passes", () => {
    expect(passwordFieldViolations([
      f(`${WEB}features/auth/a.tsx`, `<Input id="p" type="password" />`),
      f(`${WEB}features/me/b.tsx`, `<Input type={show ? "text" : "password"} />`),
      f(`${WEB}features/me/c.tsx`, `<PasswordInput id="p" autoComplete="current-password" /> // type="password" in a comment`),
      f(PASSWORD_HOME, `<Input type={shown ? "text" : "password"} />`),
    ])).toEqual([`${WEB}features/auth/a.tsx: a raw password input; use PasswordInput`, `${WEB}features/me/b.tsx: a raw password input; use PasswordInput`]);
    expect(newPasswordViolations([
      f(`${WEB}features/users/form.tsx`, `<PasswordInput autoComplete="new-password" />`),
      f(`${WEB}features/me/ok.tsx`, `<PasswordInput autoComplete="new-password" /><PasswordChecks id="c" checks={passwordChecks(pw)} />`),
    ])).toEqual([`${WEB}features/users/form.tsx: a new-password field without PasswordChecks`]);
  });

  it("a literal product name outside brand.ts is reported; BRAND.name and the package scope pass", () => {
    expect(brandViolations([
      f(`${WEB}app/(main)/users/page.tsx`, `export const metadata = { title: "Users · ${BRAND.name}" };`),
      f(`${WEB}features/x/a.tsx`, `<Failure source={BRAND.name} />; import { Panel } from "@starterkit/ui/ds";`),
      f(BRAND_HOME, `export const BRAND = { name: "${BRAND.name}" } as const;`),
    ])).toEqual([`${WEB}app/(main)/users/page.tsx: write BRAND.name, not the product name`]);
  });

  it("a list screen without ColumnsMenu, or not passing hidden to DataTable, is reported", () => {
    expect(columnsMenuViolations([
      f(`${WEB}features/a/list.tsx`, `const t = useTableQuery({}); <DataTable columns={c} />`),
      f(`${WEB}features/b/list.tsx`, `const t = useTableQuery({}); <ColumnsMenu columns={c} hidden={t.hidden} /> <DataTable columns={c} />`),
      f(`${WEB}features/c/list.tsx`, `const t = useTableQuery({}); <ColumnsMenu columns={c} hidden={t.hidden} onChange={t.setHidden} /> <DataTable columns={c} hidden={t.hidden} />`),
      f(`${WEB}features/d/detail.tsx`, `<DataTable columns={c} rows={u.recent} />`),
    ])).toEqual([
      `${WEB}features/a/list.tsx: a list screen renders ColumnsMenu and passes hidden to DataTable`,
      `${WEB}features/b/list.tsx: a list screen renders ColumnsMenu and passes hidden to DataTable`,
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
