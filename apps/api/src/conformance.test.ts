// What the web's static route checks (apps/web/src/test/architecture.test.ts, api-contract.test.ts) enforced for the
// mock, enforced for the API: (a) the routes of createApp() are the README's endpoint table, (b) every handler in
// src/**/routes.ts (Hono) and src/modules/*/controller.ts (Elysia) follows the contract's order. Handlers are read with
// the TypeScript compiler API, not regexes.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createApp, legacy } from "./app";

const SRC = import.meta.dir;
const README = readFileSync(path.join(SRC, "../../../docs/api/README.md"), "utf8");

// ---------------------------------------------------------------- (a) endpoint table

/** Routes the API has that the README does not list (internal: the web's page guards, login page and OAuth routes call them). */
const API_ONLY = [
  "GET /v1/auth/context", "GET /healthz", "GET /readyz", "GET /v1/auth/providers",
  "POST /v1/auth/oauth/{provider}/start", "POST /v1/auth/oauth/{provider}/callback",
];
/** README rows that are web routes only: the browser's side of the OAuth flow (it calls the API's start and callback). */
const WEB_ONLY = ["GET /api/auth/oauth/{provider}", "GET /api/auth/oauth/{provider}/callback", "POST /api/auth/oauth/{provider}/callback", "GET /api/auth/oauth/{provider}/mock-authorize"];

/** The routes of the Elysia app and of the Hono routers mounted inside it (until Task 18). */
const appRoutes = () => ({ routes: [...createApp().routes, ...legacy.routes] });

/** "METHOD /v1/path/{param}" of every registered route; middleware and the mount (ALL) are not routes. Hono answers HEAD/OPTIONS itself. */
const registered = (app: { routes: { method: string; path: string }[] }): string[] =>
  app.routes.filter((r) => r.method !== "ALL").map((r) => `${r.method} ${r.path.replace(/:(\w+)/g, "{$1}")}`);

/** "METHOD /api/path" of every row of the README's endpoint table. */
const documented = (md: string): string[] =>
  [...md.matchAll(/^\| (GET|HEAD|OPTIONS|POST|PATCH|PUT|DELETE) \| `([^`]+)` \|/gm)].map((m) => `${m[1]} ${m[2]}`);

/** Differences between the routes and the table (with the allowlists applied): `missing` = documented but not served, `extra` = served but not documented. */
function tableDiff(routes: string[], rows: string[]): { missing: string[]; extra: string[] } {
  const served = routes.filter((r) => !API_ONLY.includes(r)).map((r) => r.replace(" /v1/", " /api/"));
  const docs = rows.filter((r) => !WEB_ONLY.includes(r));
  return { missing: docs.filter((r) => !served.includes(r)), extra: served.filter((r) => !docs.includes(r)) };
}

describe("endpoint table (docs/api/README.md)", () => {
  const routes = registered(appRoutes());
  const rows = documented(README);

  it("every route is a README row and every row is a route, once (internal and not-yet-ported routes are allowlisted)", () => {
    expect(rows.length).toBe(new Set(rows).size);
    expect(routes.length).toBe(new Set(routes).size);
    expect(tableDiff(routes, rows)).toEqual({ missing: [], extra: [] });
  });

  it("the allowlists name real routes and real rows (a stale entry fails)", () => {
    expect(API_ONLY.filter((r) => !routes.includes(r))).toEqual([]);
    expect(WEB_ONLY.filter((r) => !rows.includes(r))).toEqual([]);
    // ported: drop it from WEB_ONLY (a same-path API route that is internal, like the OAuth callback the web calls, isn't a port)
    expect(WEB_ONLY.map((r) => r.replace(" /api/", " /v1/")).filter((r) => routes.includes(r) && !API_ONLY.includes(r))).toEqual([]);
  });

  it("fixture: a route without a row, a row without a route and a stale allowlist entry are reported", () => {
    expect(tableDiff(["GET /v1/a", "GET /v1/b/{id}"], ["GET /api/a", "POST /api/c", "GET /api/auth/oauth/{provider}"]))
      .toEqual({ missing: ["POST /api/c"], extra: ["GET /api/b/{id}"] });
    expect(registered({ routes: [{ method: "ALL", path: "/*" }, { method: "PATCH", path: "/v1/users/:id/sessions/:sid" }] })).toEqual(["PATCH /v1/users/{id}/sessions/{sid}"]);
  });
});

// ---------------------------------------------------------------- (b) handlers

/**
 * GET routes that answer one record, a summary or the caller, not a list; every other GET outside the sign-in routes pages with
 * pageQuery( (or a function that does). Keys are "GET <path under /v1>".
 */
const NON_LIST_GETS: Record<string, string> = {
  "GET /dashboard": "summary numbers; its recent list is fixed at 5",
  "GET /me": "the signed-in user",
  "GET /roles/:id": "one role",
  "GET /users/:id": "one user; its recent activity is fixed at 20",
};

type Call = { name: string; pos: number };
type Handler = { file: string; method: string; path: string; calls: Call[]; csv: boolean };
const HONO_METHODS = ["get", "post", "patch", "put", "delete"];
/**
 * Modules whose imports read or write the database, as paths without extension relative to src/: db/client and
 * kernel/db themselves, every module's public API (`modules/<m>`, imported by the Hono routes; it may query) and every
 * non-test file that imports db/client or kernel/db directly. Not transitive: a module that only reaches the database
 * through another one is not listed (its callers import the listed one anyway, and local helpers are followed in handlersOf).
 */
function dataModulesOf(files: { file: string; src: string }[]): Set<string> {
  const mods = new Set(["db/client", "kernel/db"]);
  for (const { file, src } of files) {
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    for (const s of sf.statements) {
      if (!ts.isImportDeclaration(s) || s.importClause?.isTypeOnly || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const to = resolveSpec(file, s.moduleSpecifier.text);
      if (to === "db/client" || to === "kernel/db") mods.add(file.replace(/\.ts$/, ""));
      if (/^modules\/[\w-]+$/.test(to)) mods.add(to);
    }
  }
  return mods;
}
const resolveSpec = (from: string, spec: string): string => path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));

const rootName = (e: ts.Expression): string | null =>
  ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? rootName(e.expression) : null;

/** The functions a file declares at the top level (function declarations and `const` initializers). */
const declsOf = (sf: ts.SourceFile): { name: string; node: ts.Node }[] =>
  sf.statements.flatMap((s): { name: string; node: ts.Node }[] => (ts.isFunctionDeclaration(s) && s.name ? [{ name: s.name.text, node: s }]
    : ts.isVariableStatement(s) ? s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) && d.initializer ? [{ name: d.name.text, node: d.initializer }] : [])) : []));

/** `n` calls one of `names` (by identifier) anywhere inside. */
const callsAny = (n: ts.Node, names: Set<string>): boolean =>
  (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text)) || ts.forEachChild(n, (c) => callsAny(c, names) || undefined) === true;

/** The functions of a file that record activity, directly or through another of its functions (a module's service.ts). */
function recordersOf(file: string, src: string): Set<string> {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const recorders = new Set(["recordActivity"]);
  const decls = declsOf(sf);
  for (let grown = true; grown;) {
    grown = false;
    for (const d of decls) if (!recorders.has(d.name) && callsAny(d.node, recorders)) grown = !!recorders.add(d.name);
  }
  return recorders;
}

/** `e` is a method chain on `new Elysia(…)` (a controller's routes). */
const onElysia = (e: ts.Expression, sf: ts.SourceFile): boolean =>
  ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) ? onElysia(e.expression.expression, sf)
    : ts.isPropertyAccessExpression(e) ? onElysia(e.expression, sf) : ts.isNewExpression(e) && e.expression.getText(sf) === "Elysia";

/**
 * The handlers registered in a routes file, with the calls inside each in source order: Hono `<router>.<method>("<path>",
 * …, handler)` (path under /v1), and Elysia `new Elysia()….<method>("/v1/<path>", handler, { query, guard })`, whose
 * `query` schema and `guard` option run before the handler, in that order, so they count as calls just before it. Routes
 * outside /v1 (health checks) are not the contract's. `recordersFrom`: functions of the module's service that record
 * activity.
 */
function handlersOf(file: string, src: string, dataModules: Set<string>, recordersFrom: Set<string> = new Set()): Handler[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const data = new Set(["sql", "pageQuery", "recordActivity"]);
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && dataModules.has(resolveSpec(file, s.moduleSpecifier.text)) && !s.importClause?.isTypeOnly) {
      const b = s.importClause?.namedBindings;
      if (b && ts.isNamespaceImport(b)) data.add(b.name.text);
      else if (b) for (const e of b.elements) if (!e.isTypeOnly) data.add(e.name.text);
    }
  }
  // Routers (`const x = new Hono…`) and the file's own helpers that record activity (directly or through another helper).
  const routers = new Set<string>(), recorders = new Set(["recordActivity", ...recordersFrom]);
  const decls = declsOf(sf);
  for (const d of decls) if (ts.isNewExpression(d.node) && d.node.expression.getText(sf) === "Hono") routers.add(d.name);
  // A call or tagged template whose root name is in `names`.
  const touches = (n: ts.Node, names: Set<string>): boolean =>
    ((ts.isCallExpression(n) || ts.isTaggedTemplateExpression(n)) && names.has(rootName(ts.isCallExpression(n) ? n.expression : n.tag) ?? "")) || ts.forEachChild(n, (c) => touches(c, names) || undefined) === true;
  for (let grown = true; grown;) {
    grown = false;
    for (const d of decls) {
      if (!recorders.has(d.name) && callsAny(d.node, recorders)) grown = !!recorders.add(d.name);
      if (!data.has(d.name) && touches(d.node, data)) grown = !!data.add(d.name); // a local helper that queries is data too
    }
  }
  const out: Handler[] = [];
  const visit = (n: ts.Node) => {
    const hono = ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && routers.has(n.expression.expression.text);
    const elysia = ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && onElysia(n.expression.expression, sf);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && (hono || elysia) && HONO_METHODS.includes(n.expression.name.text)) {
      const [p, ...rest] = n.arguments;
      const fn = hono ? rest.at(-1) : rest[0];
      const hook = elysia && rest[1] && ts.isObjectLiteralExpression(rest[1]) ? rest[1] : null;
      const path = p && ts.isStringLiteral(p) ? (hono ? p.text : /^\/v1(\/|$)/.test(p.text) ? p.text.slice(3) : null) : null;
      if (path !== null && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        const found: Call[] = [];
        let csv = false;
        const option = (name: string) => hook?.properties.some((o) => ts.isPropertyAssignment(o) && o.name.getText(sf) === name);
        if (option("query")) found.push({ name: "query", pos: fn.getStart(sf) - 2 });
        if (option("guard")) found.push({ name: "guard", pos: fn.getStart(sf) - 1 });
        const inner = (m: ts.Node) => {
          const at = m.getStart(sf);
          if (ts.isCallExpression(m) || ts.isTaggedTemplateExpression(m)) {
            const callee = ts.isCallExpression(m) ? m.expression : m.tag;
            const root = rootName(callee);
            if (root) found.push({ name: root === "sql" || data.has(root) ? `data:${root}` : root, pos: at });
            if (ts.isCallExpression(m) && ts.isIdentifier(callee)) found.push({ name: callee.text, pos: at });
            if (ts.isCallExpression(m) && ts.isIdentifier(callee) && recorders.has(callee.text)) found.push({ name: "recordActivity", pos: at });
          }
          if (ts.isNewExpression(m) && m.arguments?.[0] && ts.isStringLiteral(m.arguments[0]) && m.arguments[0].text === "not_found") found.push({ name: "notFound", pos: at });
          if (ts.isStringLiteral(m) && m.text === "csv") csv = true;
          ts.forEachChild(m, inner);
        };
        inner(fn);
        out.push({ file, method: n.expression.name.text.toUpperCase(), path, calls: found.sort((a, b) => a.pos - b.pos), csv });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Exported functions/consts of the files that are not routes (query files, module services) that call `pageQuery(`
 * (pagers) and the ones named `…Csv` with whether they LIMIT to CSV_MAX_ROWS.
 */
function exportsOf(files: { file: string; src: string }[]): { pagers: string[]; csv: Record<string, boolean> } {
  const pagers: string[] = [], csv: Record<string, boolean> = {};
  for (const { file, src } of files.filter((f) => !ROUTE_FILE.test(f.file))) {
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    for (const s of sf.statements) {
      const names = ts.isFunctionDeclaration(s) && s.name ? [s.name.text] : ts.isVariableStatement(s) ? s.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : [])) : [];
      if (!names.length || !(ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))) continue;
      const text = s.getText(sf);
      for (const name of names) {
        if (/\bpageQuery\s*[<(]/.test(text)) pagers.push(name);
        if (/Csv$/.test(name)) csv[name] = /\blimit \$\{CSV_MAX_ROWS\}/.test(text);
      }
    }
  }
  return { pagers, csv };
}

/** Files that register routes: the Hono routers and the Elysia module controllers. */
const ROUTE_FILE = /(^|\/)(routes|controller)\.ts$/;
/**
 * The sign-in routes (/v1/auth/*, by file: a new route elsewhere, even under /v1/auth, follows every rule): they answer
 * before a session exists. `auth/routes.ts` is the former Hono router, kept for its fixture.
 */
const AUTH_ROUTE_FILES = ["auth/routes.ts", "modules/auth/controller.ts", "modules/oauth/controller.ts"];

const first = (h: Handler, name: string) => h.calls.find((c) => c.name === name)?.pos ?? -1;
const NOT_FOUND = ["idParam", "notFound"];

/**
 * Rules for every handler of a routes file or module controller but the sign-in ones (AUTH_ROUTE_FILES: they answer
 * before a session exists):
 * guard( first (before any data call); non-GET records activity; a list GET pages with pageQuery( (the JSON branch of a
 * `format=csv` route counts: its CSV branch must call a `…Csv` function that LIMITs to CSV_MAX_ROWS); query( before
 * guard( (400 before 401); body( before idParam( / a 404 (400 before 404).
 */
function routeViolations(files: { file: string; src: string }[], nonList: Record<string, string> = NON_LIST_GETS): string[] {
  const { pagers, csv } = exportsOf(files);
  const mods = dataModulesOf(files);
  const recordersOfService = (controller: string) => {
    const service = files.find((f) => f.file === controller.replace(/controller\.ts$/, "service.ts"));
    return service ? recordersOf(service.file, service.src) : new Set<string>();
  };
  const hs = files.filter((f) => ROUTE_FILE.test(f.file) && !AUTH_ROUTE_FILES.includes(f.file))
    .flatMap((f) => handlersOf(f.file, f.src, mods, f.file.endsWith("controller.ts") ? recordersOfService(f.file) : undefined));
  const paging = new Set(["pageQuery", ...pagers]);
  const csvFns = new Set(Object.keys(csv));
  const gets = new Set<string>();
  const out = hs.flatMap((h) => {
    const id = `${h.file} ${h.method} ${h.path}`;
    const g = first(h, "guard"), firstData = Math.min(...h.calls.filter((c) => c.name.startsWith("data:")).map((c) => c.pos), Infinity);
    const q = first(h, "query"), b = first(h, "body");
    const nf = Math.min(...h.calls.filter((c) => NOT_FOUND.includes(c.name)).map((c) => c.pos), Infinity);
    if (h.method === "GET") gets.add(`GET ${h.path}`);
    return [
      ...(g < 0 ? [`${id}: no guard(`] : g > firstData ? [`${id}: reads data before guard(`] : []),
      ...(h.method === "GET" || h.calls.some((c) => c.name === "recordActivity") ? [] : [`${id}: no recordActivity(`]),
      ...(h.method !== "GET" || `GET ${h.path}` in nonList || h.calls.some((c) => paging.has(c.name)) ? [] : [`${id}: GET answers a list without pageQuery(`]),
      ...(h.csv && !h.calls.some((c) => csvFns.has(c.name)) ? [`${id}: format=csv branch without a …Csv query function`] : []),
      ...(q >= 0 && g >= 0 && q > g ? [`${id}: guard( before query( (a bad query must answer 400 before 401)`] : []),
      ...(b >= 0 && nf < b ? [`${id}: checks existence (404) before the request body (400)`] : []),
    ];
  });
  return [
    ...out,
    ...Object.entries(csv).filter(([, ok]) => !ok).map(([n]) => `${n}: CSV query without \`limit \${CSV_MAX_ROWS}\``),
    ...Object.keys(nonList).filter((k) => !gets.has(k)).map((k) => `${k}: listed as a non-list GET but has no such handler`),
  ];
}

const walk = (dir: string): string[] => [...new Bun.Glob("**/*.ts").scanSync(dir)].filter((f) => !f.endsWith(".test.ts")).map((f) => path.join(dir, f));
const real = walk(SRC).map((f) => ({ file: path.relative(SRC, f), src: readFileSync(f, "utf8") }));

describe("route handlers (src/**/routes.ts)", () => {
  it("every handler outside auth/ follows the contract's order, pages its lists and records its changes", () => {
    expect(routeViolations(real)).toEqual([]);
  });

  it("the scan sees every route the app registers (so a handler the parser misses can't hide)", () => {
    const seen = real.filter((f) => ROUTE_FILE.test(f.file)).flatMap((f) => handlersOf(f.file, f.src, dataModulesOf(real)).map((h) => `${h.method} /v1${h.path}`)).sort();
    expect(seen).toEqual(registered(appRoutes()).map((r) => r.replace(/\{(\w+)\}/g, ":$1")).filter((r) => !/ \/(healthz|readyz)$/.test(r)).sort());
  });

  // Fixtures: each rule fails on a violation, and the clean handler passes.
  const imports = `const r = new Hono(); import { guard } from "../http/guard"; import { body, idParam, query } from "../http/parse"; import { sql } from "../db/client";
import { recordActivity } from "../audit/record"; import { thing, thingPage } from "./queries"; import * as Q from "./queries";\n`;
  const routes = (code: string) => ({ file: "x/routes.ts", src: imports + code });
  const queries = (code: string) => ({ file: "x/queries.ts", src: `import { sql } from "../db/client"; import { pageQuery } from "../db/page"; import { CSV_MAX_ROWS } from "@starterkit/shared/audit";\n${code}` });
  const PAGER = queries("export const thingPage = (q) => pageQuery({ q });");
  const run = (code: string, ...more: { file: string; src: string }[]) => routeViolations([routes(code), PAGER, ...more], {});

  it("fixture: a clean list GET, mutation and csv route pass", () => {
    expect(run(`r.get("/a", async (c) => { const q = query(c, Q); await guard(c, "x.view"); return c.json(await thingPage(q)); });
r.patch("/a/:id", async (c) => { const ctx = await guard(c, "x.edit"); const b = await body(c, B); const id = idParam(c, "id", "a"); await sql.begin(async (tx) => { await recordActivity(tx, ctx, e); }); return c.json(1); });`)).toEqual([]);
    expect(run(`r.get("/a", async (c) => { await guard(c, "x.view"); return c.req.query("format") === "csv" ? c.body(await thingCsv(q)) : c.json(await thingPage(q)); });`,
      queries("export const thingCsv = (q) => sql`select 1 limit ${CSV_MAX_ROWS}`;"))).toEqual([]);
  });
  it("fixture: no guard(, or data read before it, is reported", () => {
    expect(run(`r.get("/a", async (c) => c.json(await thingPage(q)));`)).toEqual(["x/routes.ts GET /a: no guard("]);
    expect(run(`r.get("/a", async (c) => { const rows = await sql\`select 1\`; await guard(c, null); return c.json(await thingPage(q)); });`)).toEqual(["x/routes.ts GET /a: reads data before guard("]);
    expect(run(`r.get("/a", async (c) => { await thing(); await guard(c, null); return c.json(await thingPage(q)); });`)).toEqual(["x/routes.ts GET /a: reads data before guard("]);
    expect(run(`r.get("/a", async (c) => { await pageQuery(o); await guard(c, null); return c.json(1); });`)).toEqual(["x/routes.ts GET /a: reads data before guard("]);
  });
  it("fixture: a local helper that queries, and a namespace import of a data module, count as data before guard(", () => {
    expect(run(`const load = (id) => sql\`select 1 where ${"$"}{id}\`; r.get("/a", async (c) => { await load(1); await guard(c, null); return c.json(await thingPage(q)); });`))
      .toEqual(["x/routes.ts GET /a: reads data before guard("]);
    expect(run(`const load2 = () => load(); const load = () => thing(); r.get("/a", async (c) => { await load2(); await guard(c, null); return c.json(await thingPage(q)); });`))
      .toEqual(["x/routes.ts GET /a: reads data before guard("]);
    expect(run(`r.get("/a", async (c) => { await Q.roleById(1); await guard(c, null); return c.json(await thingPage(q)); });`)).toEqual(["x/routes.ts GET /a: reads data before guard("]);
    expect(run(`const pure = (x) => x + 1; r.get("/a", async (c) => { pure(1); await guard(c, null); return c.json(await thingPage(q)); });`)).toEqual([]);
  });
  it("fixture: the data modules are derived from the files that import db/client", () => {
    const f = (file: string, src: string) => ({ file, src });
    expect([...dataModulesOf([f("a/queries.ts", `import { sql } from "../db/client";`), f("a/pure.ts", `import type { sql } from "../db/client";`), f("b/x.ts", `import { y } from "../a/pure";`)])].sort())
      .toEqual(["a/queries", "db/client", "kernel/db"]);
    expect([...dataModulesOf([f("x/routes.ts", `import { recordActivity } from "../modules/audit"; import type { Ctx } from "../modules/auth";`)])].sort())
      .toEqual(["db/client", "kernel/db", "modules/audit"]);
    const real2 = [...dataModulesOf(real)];
    expect(real2).toEqual(expect.arrayContaining(["db/client", "db/page", "modules/users/service", "modules/rbac/service", "audit/queries", "db/fragments", "modules/audit", "modules/auth"]));
  });
  it("fixture: a mutation without recordActivity( is reported", () => {
    expect(run(`r.delete("/a/:id", async (c) => { await guard(c, "x.delete"); await sql\`delete from a\`; return c.json(1); });`)).toEqual(["x/routes.ts DELETE /a/:id: no recordActivity("]);
  });
  it("fixture: a list GET without pageQuery( is reported; a comment or a non-pager function doesn't count; a non-list allowlist entry passes and a stale one fails", () => {
    expect(run(`r.get("/a", async (c) => { await guard(c, "x.view"); return c.json(await thing()); }); // pageQuery( in a comment`)).toEqual(["x/routes.ts GET /a: GET answers a list without pageQuery("]);
    expect(routeViolations([routes(`r.get("/a/:id", async (c) => { await guard(c, null); return c.json(await thing()); });`)], { "GET /a/:id": "one" })).toEqual([]);
    expect(routeViolations([routes(`r.get("/a", async (c) => { await guard(c, null); return c.json(await thingPage(q)); });`), PAGER], { "GET /gone": "x" })).toEqual(["GET /gone: listed as a non-list GET but has no such handler"]);
  });
  it("fixture: a format=csv branch needs a …Csv function with limit CSV_MAX_ROWS, besides the paged JSON branch", () => {
    const get = (json: string, csv: string) => `r.get("/a", async (c) => { await guard(c, "x.view"); return q.format === "csv" ? ${csv} : ${json}; });`;
    expect(run(get("c.json(await thing())", "c.body(await thingCsv(q))"), queries("export const thingCsv = (q) => sql`select 1 limit ${CSV_MAX_ROWS}`;")))
      .toEqual(["x/routes.ts GET /a: GET answers a list without pageQuery("]); // csv alone does not make it a paged list
    expect(run(get("c.json(await thingPage(q))", "c.body(await thing())"), queries("export const thingCsv = (q) => sql`select 1 limit ${CSV_MAX_ROWS}`;")))
      .toEqual(["x/routes.ts GET /a: format=csv branch without a …Csv query function"]);
    expect(run(get("c.json(await thingPage(q))", "c.body(await thingCsv(q))"), queries("export const thingCsv = (q) => sql`select 1 limit 1000000`;")))
      .toEqual(["thingCsv: CSV query without `limit ${CSV_MAX_ROWS}`"]);
  });
  it("fixture: guard( before query( is reported", () => {
    expect(run(`r.get("/a", async (c) => { await guard(c, "x.view"); const q = query(c, Q); return c.json(await thingPage(q)); });`))
      .toEqual(["x/routes.ts GET /a: guard( before query( (a bad query must answer 400 before 401)"]);
  });
  it("fixture: a 404 (idParam( or notFound() before body( is reported; a handler without a body is free", () => {
    const post = (inner: string) => `r.post("/a/:id", async (c) => { const ctx = await guard(c, "x.edit"); ${inner} await recordActivity(tx, ctx, e); return c.json(1); });`;
    const bad = ["x/routes.ts POST /a/:id: checks existence (404) before the request body (400)"];
    expect(run(post(`const id = idParam(c, "id", "a"); const b = await body(c, B);`))).toEqual(bad);
    expect(run(post(`if (!x) throw notFound("a"); const b = await body(c, B);`))).toEqual(bad);
    expect(run(post(`if (!x) throw new ApiError("not_found"); const b = await body(c, B);`))).toEqual(bad);
    expect(run(post(`const id = idParam(c, "id", "a");`))).toEqual([]);
    expect(run(post(`const b = await body(c, B); const id = idParam(c, "id", "a");`))).toEqual([]);
  });
  it("fixture: an Elysia controller's query and guard options run before its handler, its service's recorders count", () => {
    const service = { file: "modules/x/service.ts", src: `import { recordActivity } from "../audit"; import { db } from "../../kernel/db";
export async function save(ctx, b) { await db.transaction(async (tx) => { await recordActivity(tx, ctx, e); }); }
export async function quiet(ctx) { await db.delete(t); }
export const thingPage = (q) => pageQuery({ q });` };
    const controller = (code: string) => ({ file: "modules/x/controller.ts", src: `import { Elysia } from "elysia"; import { body } from "../../kernel/parse";
import { guard } from "../auth"; import { quiet, save, thingPage } from "./service";
export const xController = () => new Elysia().use(guard)${code};` });
    const check = (code: string) => routeViolations([controller(code), service], {});
    expect(check(`.get("/v1/x", ({ query }) => thingPage(query), { query: Q, guard: "x.view" })
  .patch("/v1/x/:id", async (c) => save(c.ctx, await body(c, B)), { guard: "x.edit" })
  .get("/healthz", () => ({ ok: true }))`)).toEqual([]);
    expect(check(`.get("/v1/x", ({ query }) => thingPage(query), { query: Q })`)).toEqual(["modules/x/controller.ts GET /x: no guard("]);
    expect(check(`.delete("/v1/x/:id", ({ ctx }) => quiet(ctx), { guard: "x.delete" })`)).toEqual(["modules/x/controller.ts DELETE /x/:id: no recordActivity("]);
    expect(check(`.get("/v1/x", () => thing(), { guard: null })`)).toEqual(["modules/x/controller.ts GET /x: GET answers a list without pageQuery("]);
    expect(handlersOf("modules/x/controller.ts", controller(`.get("/v1/x", () => 1, { guard: null, query: Q })`).src, new Set()).map((h) => h.calls.map((c) => c.name)))
      .toEqual([["query", "guard"]]);
  });
  it("fixture: only the sign-in controllers are exempt; another module's route under /v1/auth follows every rule", () => {
    const src = `import { Elysia } from "elysia"; import { quiet } from "./service";
export const c = () => new Elysia().post("/v1/auth/x", async (c) => quiet(c));`;
    const service = (dir: string) => ({ file: `${dir}/service.ts`, src: "export async function quiet(c) {}" });
    expect(routeViolations([{ file: "modules/oauth/controller.ts", src }, service("modules/oauth")], {})).toEqual([]);
    expect(routeViolations([{ file: "modules/auth/controller.ts", src }, service("modules/auth")], {})).toEqual([]);
    expect(routeViolations([{ file: "modules/x/controller.ts", src }, service("modules/x")], {}))
      .toEqual(["modules/x/controller.ts POST /auth/x: no guard(", "modules/x/controller.ts POST /auth/x: no recordActivity("]);
  });
  it("fixture: auth/ routes are exempt, a non-handler call named like a route method is ignored", () => {
    expect(routeViolations([{ file: "auth/routes.ts", src: `r.post("/login", async (c) => { await sql\`select 1\`; return c.json(1); });` }], {})).toEqual([]);
    expect(run(`const m = new Map(); m.get("k", () => 1); r.get("/a", async (c) => { await guard(c, null); return c.json(await thingPage(q)); });`)).toEqual([]);
  });
});
