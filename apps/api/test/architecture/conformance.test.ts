// The API against its contract, read from createApp() and from the source with the TypeScript compiler API:
// (a) the routes are the README's endpoint table. For every /v1 route of a modules/*/controller.ts but the sign-in ones:
// (b) the `guard` option runs before the handler (an in-handler permission check only where allowlisted, before any
// service call); (c) a change records activity; (d) a list GET pages through pageQuery and a CSV branch is capped at
// CSV_MAX_ROWS; (e) nothing answers 404 or reads data before the request body; (f) a handler that reads the query has a
// `query` schema (validated before the guard); (g) the exemptions name real controllers. Calls are followed across
// files, through module indexes, into the services a handler calls and everything they call (one call graph of src/);
// src/ uses only the import forms that graph follows, and a function that records activity writes only through its
// transaction.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createApp } from "../../src/app";

type File = { file: string; src: string };

const SRC = path.join(import.meta.dir, "../../src");
const README = readFileSync(path.join(import.meta.dir, "../../../../docs/api/README.md"), "utf8");

// ---------------------------------------------------------------- (a) endpoint table

/** Routes the API has that the README does not list (internal: the web's page guards, login page and OAuth routes call them). */
const API_ONLY = [
  "GET /v1/auth/context", "GET /healthz", "GET /readyz", "GET /v1/auth/providers",
  "POST /v1/auth/oauth/{provider}/start", "POST /v1/auth/oauth/{provider}/callback",
];
/** README rows that are web routes only: the browser's side of the OAuth flow (it calls the API's start and callback). */
const WEB_ONLY = ["GET /api/auth/oauth/{provider}", "GET /api/auth/oauth/{provider}/callback", "POST /api/auth/oauth/{provider}/callback", "GET /api/auth/oauth/{provider}/mock-authorize"];

/** "METHOD /v1/path/{param}" of every registered route. */
const registered = (app: { routes: { method: string; path: string }[] }): string[] =>
  app.routes.map((r) => `${r.method} ${r.path.replace(/:(\w+)/g, "{$1}")}`);

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
  const routes = registered(createApp());
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
    expect(registered({ routes: [{ method: "PATCH", path: "/v1/users/:id/sessions/:sid" }] })).toEqual(["PATCH /v1/users/{id}/sessions/{sid}"]);
  });
});

// ---------------------------------------------------------------- call graph of src/

/** A relative specifier as one of `known` ("x.ts" or "x/index.ts"); null for a package. */
function fileOf(from: string, spec: string, known: Set<string>): string | null {
  if (!spec.startsWith(".")) return null;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.ts$/, "");
  return [`${p}.ts`, `${p}/index.ts`].find((c) => known.has(c)) ?? null;
}

const rootName = (e: ts.Expression): string | null =>
  ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? rootName(e.expression) : ts.isCallExpression(e) ? rootName(e.expression) : null;

/** `n` is a name being declared or a property name, not a reference to something in scope. */
const notReference = (n: ts.Identifier): boolean => {
  const p = n.parent;
  return (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n)
    || ((ts.isParameter(p) || ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p)) && p.name === n)
    || (ts.isBindingElement(p) && p.propertyName === n) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p);
};

const newApiError = (n: ts.Node, code: string): boolean =>
  ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "ApiError" && !!n.arguments?.[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === code;
const contains = (n: ts.Node, test: (m: ts.Node) => boolean): boolean => test(n) || ts.forEachChild(n, (c) => contains(c, test) || undefined) === true;

/**
 * Every top-level declaration of `files` ("file#name": function declarations and `const` initializers) with the
 * declarations it references, a name resolved through imports and index re-exports to where it is declared. `reaching`
 * answers which declarations reach a seed, directly or through others.
 */
function graphOf(files: File[]) {
  const known = new Set(files.map((f) => f.file));
  const sfs = new Map(files.map((f) => [f.file, ts.createSourceFile(f.file, f.src, ts.ScriptTarget.Latest, true)]));
  const decls = new Map<string, ts.Node>();
  const links = new Map<string, { file: string; name: string }>(); // "file#local" → the binding it imports or re-exports
  for (const [file, sf] of sfs) {
    for (const s of sf.statements) {
      if (ts.isFunctionDeclaration(s) && s.name) decls.set(`${file}#${s.name.text}`, s);
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) decls.set(`${file}#${d.name.text}`, d.initializer);
      const spec = (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) ? s.moduleSpecifier.text : null;
      const to = spec && fileOf(file, spec, known);
      if (!to) continue;
      const named = ts.isImportDeclaration(s) ? s.importClause?.namedBindings : ts.isExportDeclaration(s) ? s.exportClause : undefined;
      if (named && (ts.isNamedImports(named) || ts.isNamedExports(named))) {
        for (const e of named.elements) links.set(`${file}#${e.name.text}`, { file: to, name: (e.propertyName ?? e.name).text });
      }
    }
  }
  /** The declaration `name` in `file` stands for; null for a parameter, a local, a global or a package export. */
  const resolve = (file: string, name: string, depth = 0): string | null => {
    const key = `${file}#${name}`;
    if (decls.has(key)) return key;
    const via = links.get(key);
    return via && depth < 20 ? resolve(via.file, via.name, depth + 1) : null;
  };
  const edges = new Map<string, Set<string>>();
  for (const [id, node] of decls) {
    const file = id.slice(0, id.indexOf("#"));
    const to = new Set<string>();
    const visit = (n: ts.Node) => {
      if (ts.isIdentifier(n) && !notReference(n)) {
        const r = resolve(file, n.text);
        if (r && r !== id) to.add(r);
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    edges.set(id, to);
  }
  /** `seeds` and every declaration that references one, directly or through others. */
  const reaching = (seeds: Iterable<string>): Set<string> => {
    const out = new Set(seeds);
    for (let grown = true; grown;) {
      grown = false;
      for (const [id, to] of edges) if (!out.has(id) && [...to].some((t) => out.has(t))) grown = !!out.add(id);
    }
    return out;
  };
  const named = (test: (id: string, node: ts.Node) => boolean) => [...decls].filter(([id, n]) => test(id, n)).map(([id]) => id);
  return { sfs, decls, resolve, reaching, named };
}

// ---------------------------------------------------------------- (b)–(f) handlers

type Call = { name: string; id: string | null; pos: number };
type Handler = {
  file: string; method: string; path: string; inline: boolean; calls: Call[]; csv: boolean; options: string[];
  guard: "missing" | "null" | "perm"; readsQuery: boolean;
};
const ROUTE_METHODS = ["get", "post", "patch", "put", "delete"];
/** What a controller's `new Elysia()` chain may call: plugins and routes. A lifecycle hook (derive, resolve, onBeforeHandle…) would run code the scan can't order against the guard. */
const CHAIN_OK = new Set(["use", ...ROUTE_METHODS]);
/** Route options the scan knows the place of: Elysia validates `query`, then runs the `guard` macro's resolve, then the handler. */
const HOOK_OK = new Set(["query", "guard"]);
/** The plugins a checked controller may `.use(…)`: exactly what the real tree uses (a stale entry fails). Any other plugin could add a hook that runs before the guard. */
const USE_OK = ["modules/auth/guard.ts#guard"];

/** `e` is a method chain on `new Elysia(…)`. */
const onElysia = (e: ts.Expression): boolean =>
  ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) ? onElysia(e.expression.expression)
    : ts.isNewExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "Elysia";

/**
 * The routes of a controller with the calls inside each handler, each at the point it runs (the end of the call, so
 * `save(await body(c, B))` reads the body first), resolved to their declarations; and the chain methods it may not use.
 */
function handlersOf(file: string, g: ReturnType<typeof graphOf>, useOk: string[] = USE_OK): { handlers: Handler[]; chain: string[]; uses: string[] } {
  const sf = g.sfs.get(file)!;
  const handlers: Handler[] = [], chain: string[] = [], uses: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && onElysia(n.expression.expression)) {
      const method = n.expression.name.text;
      if (!CHAIN_OK.has(method)) chain.push(`${file}: .${method}( on a controller runs code the scan can't order against the guard`);
      if (method === "use") {
        const arg = n.arguments[0];
        const id = arg && ts.isIdentifier(arg) ? g.resolve(file, arg.text) : null;
        if (id) uses.push(id);
        if (!id || !useOk.includes(id)) chain.push(`${file}: .use(${arg?.getText(sf) ?? ""}) mounts a plugin other than ${useOk.join(", ")}; its hooks could run before the guard`);
      }
      const [p, fn, hook] = n.arguments;
      if (ROUTE_METHODS.includes(method) && p && ts.isStringLiteral(p)) {
        const options = hook && ts.isObjectLiteralExpression(hook) ? [...hook.properties] : [];
        const guardOpt = options.find((o) => o.name?.getText(sf) === "guard");
        const h: Handler = {
          file, method: method.toUpperCase(), path: p.text, inline: !!fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)), calls: [], csv: false,
          options: options.map((o) => o.name?.getText(sf) ?? "?"),
          guard: !guardOpt ? "missing" : ts.isPropertyAssignment(guardOpt) && guardOpt.initializer.kind === ts.SyntaxKind.NullKeyword ? "null" : "perm",
          readsQuery: false,
        };
        if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
          const param = fn.parameters[0]?.name;
          const bindsQuery = (b: ts.ObjectBindingPattern) => b.elements.some((e) => (e.propertyName ?? e.name).getText(sf) === "query");
          // `({ query })`, `c.query`, or `const { query } = c` in the body
          h.readsQuery = !!param && (ts.isObjectBindingPattern(param) ? bindsQuery(param)
            : contains(fn.body, (m) => (ts.isPropertyAccessExpression(m) && m.name.text === "query" && m.expression.getText(sf) === param.getText(sf))
              || (ts.isVariableDeclaration(m) && ts.isObjectBindingPattern(m.name) && m.initializer?.getText(sf) === param.getText(sf) && bindsQuery(m.name))));
          const inner = (m: ts.Node) => {
            if (ts.isCallExpression(m) || ts.isTaggedTemplateExpression(m)) {
              const callee = ts.isCallExpression(m) ? m.expression : m.tag;
              const root = rootName(callee);
              h.calls.push({ name: root ?? "", id: root ? g.resolve(file, root) : null, pos: m.end });
              if (ts.isPropertyAccessExpression(callee) && callee.name.text === "has" && /\bperms$/.test(callee.expression.getText(sf))) h.calls.push({ name: "perms.has", id: null, pos: m.end });
            }
            if (newApiError(m, "not_found")) h.calls.push({ name: "notFound", id: null, pos: m.end });
            if (newApiError(m, "forbidden")) h.calls.push({ name: "forbidden", id: null, pos: m.end });
            if (ts.isStringLiteral(m) && m.text === "csv") h.csv = true;
            ts.forEachChild(m, inner);
          };
          inner(fn.body);
          h.calls.sort((a, b) => a.pos - b.pos);
        }
        handlers.push(h);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { handlers, chain, uses };
}

type Allow = { nonList: Record<string, string>; gates: Record<string, string>; authFiles: string[]; use?: string[] };

/** GET routes that answer one record, a summary or the caller, not a list; every other GET pages through pageQuery. */
const NON_LIST_GETS: Record<string, string> = {
  "GET /v1/dashboard": "summary numbers; its recent list is fixed at 5",
  "GET /v1/me": "the signed-in user",
  "GET /v1/roles/:id": "one role",
  "GET /v1/users/:id": "one user; its recent activity is fixed at 20",
};
/**
 * Routes that check their permission in the handler (`{ guard: null }`, then `ctx.perms.has(…)` before any service
 * call), because the permission depends on the body.
 */
const IN_HANDLER_GATES: Record<string, string> = {
  "POST /v1/users/bulk": "delete needs user.delete, the other actions user.edit: the session is checked (401), the body read, then the permission (403)",
};
/** The sign-in controllers, by file: they answer before a session exists. A route elsewhere, even under /v1/auth, follows every rule. */
const AUTH_ROUTE_FILES = ["modules/auth/controller.ts", "modules/oauth/controller.ts"];
const REAL_ALLOW: Allow = { nonList: NON_LIST_GETS, gates: IN_HANDLER_GATES, authFiles: AUTH_ROUTE_FILES };

const CONTROLLER = /^modules\/[\w-]+\/controller\.ts$/;

/** Every rule's violations over `files` (paths relative to src/). */
function routeViolations(files: File[], allow: Allow = REAL_ALLOW): string[] {
  const g = graphOf(files);
  const data = g.reaching(["kernel/db.ts#db", "kernel/db.ts#client"]);
  const answers404 = g.reaching(g.named((_, n) => contains(n, (m) => newApiError(m, "not_found"))));
  const recorders = g.reaching(["modules/audit/record.ts#recordActivity"]);
  const pagers = g.reaching(["kernel/pagination.ts#pageQuery"]);
  const csvFns = g.named((id) => /#\w*Csv$/.test(id));
  const csvReach = g.reaching(csvFns);
  const useOk = allow.use ?? USE_OK;
  const scanned = files.filter((f) => CONTROLLER.test(f.file)).map((f) => ({ file: f.file, ...handlersOf(f.file, g, useOk) }));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const { file, handlers, chain } of scanned) {
    if (allow.authFiles.includes(file)) continue;
    out.push(...chain);
    for (const h of handlers.filter((x) => /^\/v1(\/|$)/.test(x.path))) {
      const key = `${h.method} ${h.path}`, id = `${file} ${key}`;
      seen.add(key);
      if (!h.inline) {
        out.push(`${id}: handler is not an inline function (the scan can't read it)`);
        continue;
      }
      const reaches = (set: Set<string>) => h.calls.some((c) => c.id !== null && set.has(c.id));
      const firstPos = (test: (c: Call) => boolean) => h.calls.find(test)?.pos ?? Infinity;
      const service = firstPos((c) => c.id !== null && data.has(c.id));
      // (b) the guard option, or the allowlisted in-handler gate
      if (h.guard === "missing") out.push(`${id}: no guard option`);
      for (const o of h.options.filter((x) => !HOOK_OK.has(x))) out.push(`${id}: route option ${o} runs code the scan can't order against the guard`);
      const gate = h.calls.some((c) => c.name === "forbidden");
      if (gate && !(key in allow.gates)) out.push(`${id}: checks a permission in the handler; use the guard option`);
      if (gate && key in allow.gates) {
        if (h.guard !== "null") out.push(`${id}: an in-handler permission check needs { guard: null }`);
        if (firstPos((c) => c.name === "perms.has") > service) out.push(`${id}: checks its permission after a service call`);
      }
      // (c) a change records activity
      if (h.method !== "GET" && !reaches(recorders)) out.push(`${id}: no recordActivity (in the handler or a service it calls)`);
      // (d) lists page; a CSV branch calls a capped …Csv function
      if (h.method === "GET" && !(key in allow.nonList) && !reaches(pagers)) out.push(`${id}: GET answers a list without pageQuery`);
      if (h.csv && !reaches(csvReach)) out.push(`${id}: format=csv branch without a …Csv function`);
      // (e) nothing answers 404 or reads data before the body
      const b = firstPos((c) => c.name === "body");
      if (b < Infinity && h.calls.some((c) => c.pos < b && (c.name === "notFound" || (c.id !== null && (answers404.has(c.id) || data.has(c.id)))))) {
        out.push(`${id}: answers 404 or reads data before the request body (400)`);
      }
      // (f) the query through the route's schema, which Elysia validates before the guard
      if (h.readsQuery && !h.options.includes("query")) out.push(`${id}: reads the query without a query schema option (a bad query must answer 400 before 401)`);
    }
  }
  // (c) an entry commits with its change: a function that records activity writes only through its transaction handle
  const dbWrite = (n: ts.Node, file: string) => contains(n, (m) => ts.isCallExpression(m) && ts.isPropertyAccessExpression(m.expression)
    && ["insert", "update", "delete"].includes(m.expression.name.text) && ts.isIdentifier(m.expression.expression)
    && g.resolve(file, m.expression.expression.text) === "kernel/db.ts#db");
  for (const id of g.named((d, n) => contains(n, (m) => ts.isCallExpression(m) && ts.isIdentifier(m.expression)
    && g.resolve(d.slice(0, d.indexOf("#")), m.expression.text) === "modules/audit/record.ts#recordActivity"))) {
    if (dbWrite(g.decls.get(id)!, id.slice(0, id.indexOf("#")))) out.push(`${id}: records activity but writes through db, outside the transaction the entry is in`);
  }
  for (const id of csvFns) {
    if (!/\.limit\(\s*CSV_MAX_ROWS\s*\)/.test(g.decls.get(id)!.getText())) out.push(`${id.split("#")[1]}: CSV query without .limit(CSV_MAX_ROWS)`);
  }
  const gated = new Set(scanned.flatMap((s) => s.handlers.filter((h) => h.calls.some((c) => c.name === "forbidden")).map((h) => `${h.method} ${h.path}`)));
  // (g) and every allowlist: a stale entry fails
  for (const k of Object.keys(allow.nonList)) if (!seen.has(k) || !k.startsWith("GET ")) out.push(`${k}: listed as a non-list GET but has no such handler`);
  for (const k of Object.keys(allow.gates)) if (!gated.has(k)) out.push(`${k}: listed as an in-handler permission check but has no such handler`);
  for (const u of useOk) if (!scanned.some((s) => !allow.authFiles.includes(s.file) && s.uses.includes(u))) out.push(`${u}: allowed in .use( but no checked controller uses it`);
  for (const f of allow.authFiles) {
    if (!scanned.some((s) => s.file === f && s.handlers.length)) out.push(`${f}: listed as a sign-in controller but has no routes`);
  }
  return out;
}

/**
 * Import forms the call graph does not follow, so they would hide a call from every rule: a namespace or default import
 * of a relative module, `export *`, and `import()`. src/ uses named imports and re-exports only.
 */
function graphGaps(files: File[]): string[] {
  return files.flatMap(({ file, src }) => {
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    const at = (n: ts.Node) => `${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
    const out: string[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith(".") && n.importClause) {
        if (n.importClause.name) out.push(`${at(n)}: default import of a relative module; use a named import (the call graph follows names only)`);
        if (n.importClause.namedBindings && ts.isNamespaceImport(n.importClause.namedBindings)) out.push(`${at(n)}: namespace import of a relative module; use named imports (the call graph follows names only)`);
      }
      if (ts.isExportDeclaration(n) && n.moduleSpecifier && !n.exportClause) out.push(`${at(n)}: export * hides what a module exports; name each export`);
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) out.push(`${at(n)}: dynamic import() is not followed by the call graph; import it statically`);
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return out;
  });
}

const real: File[] = [...new Bun.Glob("**/*.ts").scanSync(SRC)].filter((f) => !f.endsWith(".test.ts")).map((f) => ({ file: f, src: readFileSync(path.join(SRC, f), "utf8") }));

describe("call graph coverage (src/)", () => {
  it("src/ imports only by name, so the call graph sees every call", () => {
    expect(graphGaps(real)).toEqual([]);
  });

  it("fixture: a namespace import, a default import, export * and import() are reported; named imports and a package default pass", () => {
    expect(graphGaps([{ file: "modules/x/service.ts", src: [
      `import * as Q from "./queries";`,
      `import helper from "../y/helper";`,
      `export * from "./rules";`,
      `const m = await import("../oauth");`,
      `import pino from "pino"; import { a } from "./a"; export { b } from "./b"; import type { C } from "./c";`,
    ].join("\n") }])).toEqual([
      "modules/x/service.ts:1: namespace import of a relative module; use named imports (the call graph follows names only)",
      "modules/x/service.ts:2: default import of a relative module; use a named import (the call graph follows names only)",
      "modules/x/service.ts:3: export * hides what a module exports; name each export",
      "modules/x/service.ts:4: dynamic import() is not followed by the call graph; import it statically",
    ]);
  });
});

describe("route handlers (src/modules/*/controller.ts)", () => {
  it("every handler outside the sign-in controllers follows the contract's order, pages its lists and records its changes", () => {
    expect(routeViolations(real)).toEqual([]);
  });

  it("the scan sees every route the app registers (so a handler the parser misses can't hide)", () => {
    const g = graphOf(real);
    const seen = real.filter((f) => CONTROLLER.test(f.file)).flatMap((f) => handlersOf(f.file, g).handlers.map((h) => `${h.method} ${h.path}`)).sort();
    expect(seen).toEqual(createApp().routes.map((r) => `${r.method} ${r.path}`).sort());
  });

  // Fixtures: each rule fails on a violation, and the clean routes pass. Stubs of the kernel and audit files the rules
  // start from, a service of module x, and a module y whose service hides a data read behind its index.
  const KERNEL: File[] = [
    { file: "kernel/db.ts", src: "export const db = drizzle({ client });" },
    { file: "kernel/errors.ts", src: `export const notFound = (n) => new ApiError("not_found", n);` },
    { file: "kernel/parse.ts", src: `import { notFound } from "./errors";
export async function body(c, s) { return s.parse(await c.request.json()); }
export function idParam(id, noun) { if (!id) throw notFound(noun); return id; }` },
    { file: "kernel/pagination.ts", src: `import { db } from "./db"; export async function pageQuery(o) { return db.select(); }` },
    { file: "modules/audit/record.ts", src: "export async function recordActivity(tx, ctx, e) { await tx.insert(t); }" },
    { file: "modules/audit/index.ts", src: `export { recordActivity } from "./record";` },
    { file: "modules/auth/guard.ts", src: "export const guard = new Elysia().macro({});" },
    { file: "modules/auth/index.ts", src: `export { guard } from "./guard";` },
    { file: "modules/y/service.ts", src: `import { db } from "../../kernel/db"; export const lookup = (id) => db.select().where(id);` },
    { file: "modules/y/index.ts", src: `export { lookup } from "./service";` },
  ];
  const SERVICE: File = { file: "modules/x/service.ts", src: `import { db } from "../../kernel/db"; import { notFound } from "../../kernel/errors";
import { pageQuery } from "../../kernel/pagination"; import { recordActivity } from "../audit";
export const thingPage = (q) => pageQuery({ q });
export async function save(ctx, b) { await db.transaction(async (tx) => { await write(tx, ctx); }); }
async function write(tx, ctx) { await recordActivity(tx, ctx, e); }
export async function quiet(ctx) { await db.delete(t); }
export async function check(id) { if (!id) throw notFound("thing"); }
export const pure = (x) => x + 1;
export const thingCsv = (q) => db.select().limit(CSV_MAX_ROWS);` };
  const controller = (code: string, file = "modules/x/controller.ts"): File => ({ file, src: `import { Elysia } from "elysia"; import { body, idParam } from "../../kernel/parse";
import { notFound } from "../../kernel/errors"; import { guard } from "../auth"; import { lookup } from "../y";
import { check, pure, quiet, save, thingCsv, thingPage } from "./service";
export const xController = () => new Elysia().use(guard)${code};` });
  const NONE: Allow = { nonList: {}, gates: {}, authFiles: [] };
  const run = (code: string, allow: Allow = NONE, ...more: File[]) => routeViolations([...KERNEL, SERVICE, controller(code), ...more], allow);
  const X = "modules/x/controller.ts";

  it("fixture: a clean list GET, change, CSV route and health check pass", () => {
    expect(run(`.get("/v1/x", ({ query }) => thingPage(query), { query: Q, guard: "x.view" })
  .patch("/v1/x/:id", async (c) => {
    const b = await body(c, B);
    return save(c.ctx, idParam(c.params.id, "x"), b);
  }, { guard: "x.edit" })
  .get("/v1/x.csv", async ({ query }) => (query.format === "csv" ? thingCsv(query) : thingPage(query)), { query: Q, guard: "x.view" })
  .get("/healthz", () => ({ ok: true }))`)).toEqual([]);
  });

  it("fixture (b): no guard option, an unknown route option, a lifecycle hook, a handler not inline", () => {
    expect(run(`.get("/v1/x", ({ query }) => thingPage(query), { query: Q })`)).toEqual([`${X} GET /v1/x: no guard option`]);
    expect(run(`.get("/v1/x", () => thingPage({}), { guard: "x.view", beforeHandle: () => lookup(1) })`))
      .toEqual([`${X} GET /v1/x: route option beforeHandle runs code the scan can't order against the guard`]);
    expect(run(`.derive(() => ({ row: lookup(1) })).get("/v1/x", () => thingPage({}), { guard: "x.view" })`))
      .toEqual([`${X}: .derive( on a controller runs code the scan can't order against the guard`]);
    expect(run(`.get("/v1/x", handler, { guard: "x.view" })`)).toEqual([`${X} GET /v1/x: handler is not an inline function (the scan can't read it)`]);
  });

  it("fixture (b): .use( takes only the listed plugins (the auth guard), and a listed plugin no controller uses is stale", () => {
    const loader = { file: "modules/x/loader.ts", src: `export const loader = new Elysia().derive(() => ({ row: 1 }));` };
    const withLoader = (code: string) => routeViolations([...KERNEL, SERVICE, loader,
      { ...controller(code), src: `import { loader } from "./loader";\n${controller(code).src}` }], NONE);
    expect(withLoader(`.use(loader).get("/v1/x", () => thingPage({}), { guard: "x.view" })`))
      .toEqual([`${X}: .use(loader) mounts a plugin other than modules/auth/guard.ts#guard; its hooks could run before the guard`]);
    expect(run(`.get("/v1/x", () => thingPage({}), { guard: "x.view" })`, { ...NONE, use: ["modules/auth/guard.ts#guard", "kernel/plugins/context.ts#context"] }))
      .toEqual(["kernel/plugins/context.ts#context: allowed in .use( but no checked controller uses it"]);
  });

  it("fixture (b): an in-handler permission check passes only when allowlisted, with { guard: null }, before any service call", () => {
    const bulk = (opts: string, order: "gate-first" | "service-first") => `.post("/v1/x/bulk", async (c) => {
      const b = await body(c, B);
      ${order === "gate-first" ? `if (!c.ctx.perms.has("x.edit")) throw new ApiError("forbidden"); return save(c.ctx, b);`
        : `const r = await save(c.ctx, b); if (!c.ctx.perms.has("x.edit")) throw new ApiError("forbidden"); return r;`}
    }, ${opts})`;
    const gates: Allow = { ...NONE, gates: { "POST /v1/x/bulk": "the body picks the permission" } };
    expect(run(bulk("{ guard: null }", "gate-first"), gates)).toEqual([]);
    expect(run(bulk("{ guard: null }", "gate-first"))).toEqual([`${X} POST /v1/x/bulk: checks a permission in the handler; use the guard option`]);
    expect(run(bulk(`{ guard: "x.view" }`, "gate-first"), gates)).toEqual([`${X} POST /v1/x/bulk: an in-handler permission check needs { guard: null }`]);
    expect(run(bulk("{ guard: null }", "service-first"), gates)).toEqual([`${X} POST /v1/x/bulk: checks its permission after a service call`]);
    expect(run(`.get("/v1/x", () => thingPage({}), { guard: "x.view" })`, { ...NONE, gates: { "POST /v1/gone": "x" } }))
      .toEqual(["POST /v1/gone: listed as an in-handler permission check but has no such handler"]);
  });

  it("fixture (c): a change that never records activity, in the handler or any service it calls, is reported", () => {
    expect(run(`.delete("/v1/x/:id", ({ ctx }) => quiet(ctx), { guard: "x.delete" })`)).toEqual([`${X} DELETE /v1/x/:id: no recordActivity (in the handler or a service it calls)`]);
    expect(run(`.delete("/v1/x/:id", ({ ctx }) => save(ctx), { guard: "x.delete" })`)).toEqual([]); // save → write → recordActivity
  });

  it("fixture (c): a function that records activity and also writes through db (outside the entry's transaction) is reported", () => {
    const leaky = { file: "modules/x/leaky.ts", src: `import { db } from "../../kernel/db"; import { recordActivity } from "../audit";
export async function rename(ctx, id) { await db.update(t).set({ id }); await db.transaction((tx) => recordActivity(tx, ctx, e)); }
export async function tidy(ctx) { await db.transaction(async (tx) => { await tx.delete(t); await recordActivity(tx, ctx, e); }); }` };
    expect(run(`.get("/v1/x", () => thingPage({}), { guard: "x.view" })`, NONE, leaky))
      .toEqual(["modules/x/leaky.ts#rename: records activity but writes through db, outside the transaction the entry is in"]);
  });

  it("fixture (d): a list GET without pageQuery, a stale non-list entry, a CSV branch without a capped …Csv function", () => {
    expect(run(`.get("/v1/x", () => lookup(1), { guard: null })`)).toEqual([`${X} GET /v1/x: GET answers a list without pageQuery`]);
    expect(run(`.get("/v1/x/:id", () => lookup(1), { guard: null })`, { ...NONE, nonList: { "GET /v1/x/:id": "one" } })).toEqual([]);
    expect(run(`.get("/v1/x", () => thingPage({}), { guard: null })`, { ...NONE, nonList: { "GET /v1/gone": "x" } }))
      .toEqual(["GET /v1/gone: listed as a non-list GET but has no such handler"]);
    expect(run(`.get("/v1/x", ({ query }) => (query.format === "csv" ? lookup(1) : thingPage(query)), { query: Q, guard: null })`))
      .toEqual([`${X} GET /v1/x: format=csv branch without a …Csv function`]);
    expect(run(`.get("/v1/x", ({ query }) => (query.format === "csv" ? thingCsv(query) : lookup(1)), { query: Q, guard: null })`))
      .toEqual([`${X} GET /v1/x: GET answers a list without pageQuery`]); // the CSV branch alone does not make a paged list
    expect(run(`.get("/v1/x", () => thingPage({}), { guard: null })`, NONE, { file: "modules/x/export.ts", src: "export const allCsv = (q) => db.select().limit(1000000);" }))
      .toEqual(["allCsv: CSV query without .limit(CSV_MAX_ROWS)"]);
  });

  it("fixture (e): a 404 or a data read before body(, also inside a service or another module's service, is reported", () => {
    const post = (inner: string) => `.post("/v1/x/:id", async (c) => { ${inner} return save(c.ctx, b); }, { guard: "x.edit" })`;
    const bad = [`${X} POST /v1/x/:id: answers 404 or reads data before the request body (400)`];
    expect(run(post(`const id = idParam(c.params.id, "x"); const b = await body(c, B);`))).toEqual(bad);
    expect(run(post(`if (!c.params.id) throw notFound("x"); const b = await body(c, B);`))).toEqual(bad);
    expect(run(post(`if (!c.params.id) throw new ApiError("not_found"); const b = await body(c, B);`))).toEqual(bad);
    expect(run(post(`await check(c.params.id); const b = await body(c, B);`))).toEqual(bad); // the 404 inside the service
    expect(run(post(`await lookup(c.params.id); const b = await body(c, B);`))).toEqual(bad); // a data read behind module y's index
    expect(run(post(`pure(1); const b = await body(c, B); await check(idParam(c.params.id, "x"));`))).toEqual([]);
    // arguments run left to right: the 404 runs before the body here
    expect(run(`.patch("/v1/x/:id", async (c) => save(c.ctx, idParam(c.params.id, "x"), await body(c, B)), { guard: "x.edit" })`))
      .toEqual([`${X} PATCH /v1/x/:id: answers 404 or reads data before the request body (400)`]);
    expect(run(`.delete("/v1/x/:id", async ({ ctx, params }) => { await check(params.id); return save(ctx); }, { guard: "x.delete" })`)).toEqual([]); // no body
  });

  it("fixture (f): a handler that reads the query without a query schema option is reported", () => {
    expect(run(`.get("/v1/x", ({ query }) => thingPage(query), { guard: "x.view" })`))
      .toEqual([`${X} GET /v1/x: reads the query without a query schema option (a bad query must answer 400 before 401)`]);
    expect(run(`.get("/v1/x", (c) => thingPage(Q.parse(c.query)), { guard: "x.view" })`))
      .toEqual([`${X} GET /v1/x: reads the query without a query schema option (a bad query must answer 400 before 401)`]);
    expect(run(`.get("/v1/x", (c) => { const { query } = c; return thingPage(query); }, { guard: "x.view" })`))
      .toEqual([`${X} GET /v1/x: reads the query without a query schema option (a bad query must answer 400 before 401)`]);
    expect(run(`.get("/v1/x", (c) => { const { query: q } = c; return thingPage(q); }, { query: Q, guard: "x.view" })`)).toEqual([]);
  });

  it("fixture (g): only the listed sign-in controllers are exempt, and a stale entry fails", () => {
    const signIn = (file: string) => controller(`.post("/v1/auth/x", async (c) => quiet(await body(c, B)))`, file);
    expect(routeViolations([...KERNEL, SERVICE, signIn("modules/x/controller.ts")], { ...NONE, authFiles: ["modules/x/controller.ts"], use: [] })).toEqual([]);
    expect(routeViolations([...KERNEL, SERVICE, signIn("modules/x/controller.ts")], NONE))
      .toEqual([`${X} POST /v1/auth/x: no guard option`, `${X} POST /v1/auth/x: no recordActivity (in the handler or a service it calls)`]);
    expect(routeViolations([...KERNEL, SERVICE, controller("")], { ...NONE, authFiles: ["modules/x/controller.ts", "modules/gone/controller.ts"], use: [] })).toEqual([
      "modules/x/controller.ts: listed as a sign-in controller but has no routes",
      "modules/gone/controller.ts: listed as a sign-in controller but has no routes",
    ]);
  });
});
