// The modulith's boundaries (refactor spec "Modular monolith"), read from the source with the TypeScript compiler API:
// (1) a module is used only through its index.ts, (2) kernel/ never imports modules/, (3) every table has exactly one
// owning modules/<m>/schema.ts, (4) tests live only in tests/ folders or apps/api/test, (5) no hand-written SQL
// statement in src/ outside the migration runner. Each rule has a fixture that proves it fails.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { client } from "../../src/kernel/db";

type File = { file: string; src: string };

const ROOT = path.join(import.meta.dir, "../..");

/**
 * Not yet moved to the module layout (Hono routers, their queries and tests, the raw-SQL shims they use): exempt from
 * every rule until Tasks 16–18 move them. A stale entry (no such path) fails.
 */
const LEGACY = [
  "src/auth/", "src/audit/", "src/dashboard/", "src/me/", "src/rbac/", "src/users/", "src/http/",
  "src/db/client.ts", "src/db/page.ts", "src/conformance.test.ts",
];
/** The migration runner applies SQL files and creates databases: the only place that writes SQL by hand. */
const RAW_SQL_OK = ["src/db/migrate.ts"];

const legacy = (f: string) => LEGACY.some((p) => (p.endsWith("/") ? f.startsWith(p) : f === p));
const moduleOf = (f: string) => /^src\/modules\/([\w-]+)\//.exec(f)?.[1] ?? null;

/** A specifier as a path from apps/api without extension or `/index`. */
const tidy = (p: string) => p.replace(/\.ts$/, "").replace(/\/index$/, "");

/**
 * The module specifiers a file imports or re-exports: a relative one resolved against the file, a package or absolute
 * one that reaches into this app's `src/modules` (`@starterkit/api/src/modules/…`, `/…/apps/api/src/modules/…`) mapped
 * to `src/modules/…`; other packages stay as they are.
 */
function importsOf({ file, src }: File): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const specs: string[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) specs.push(n.moduleSpecifier.text);
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) specs.push(n.arguments[0].text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return specs.map((s) => {
    if (s.startsWith(".")) return tidy(path.posix.normalize(path.posix.join(path.posix.dirname(file), s)));
    const inApp = /(?:^@starterkit\/api\/|\/apps\/api\/)(src\/.+)$/.exec(s);
    return inApp ? tidy(path.posix.normalize(inApp[1]!)) : s;
  });
}

/** (1) An import of another module's file other than its index; a schema.ts may import another module's schema.ts (foreign keys). */
function deepImports(files: File[]): string[] {
  return files.filter((f) => !legacy(f.file)).flatMap((f) => importsOf(f).flatMap((to) => {
    const m = /^src\/modules\/([\w-]+)\/(.+)$/.exec(to);
    if (!m || m[1] === moduleOf(f.file)) return [];
    if (m[2] === "schema" && /^src\/modules\/[\w-]+\/schema\.ts$/.test(f.file)) return [];
    return [`${f.file} → ${to}: import "src/modules/${m[1]}" (its index.ts), not its internals`];
  }));
}

/** (2) kernel/ importing anything under modules/. */
function kernelImports(files: File[]): string[] {
  return files.filter((f) => f.file.startsWith("src/kernel/"))
    .flatMap((f) => importsOf(f).filter((to) => to.startsWith("src/modules")).map((to) => `${f.file} → ${to}: kernel/ never imports modules/`));
}

/** (3) Tables declared outside a modules/<m>/schema.ts, declared twice, or present in the database without an owner. */
function tableOwners(files: File[], dbTables: string[]): string[] {
  const owners = new Map<string, string[]>();
  const out: string[] = [];
  for (const f of files.filter((x) => x.file.startsWith("src/"))) {
    for (const m of f.src.matchAll(/\bpgTable\(\s*["'`]([\w-]+)["'`]/g)) {
      if (!/^src\/modules\/[\w-]+\/schema\.ts$/.test(f.file)) out.push(`${f.file}: table ${m[1]} declared outside a modules/<m>/schema.ts`);
      owners.set(m[1]!, [...(owners.get(m[1]!) ?? []), f.file]);
    }
  }
  for (const [t, by] of owners) if (by.length > 1) out.push(`table ${t} owned by ${by.join(", ")}`);
  for (const t of dbTables) if (!owners.has(t)) out.push(`table ${t} exists in the database but no module owns it`);
  return out;
}

/** (4) A test file outside modules/<m>/tests/, kernel/tests/ and apps/api/test/. */
function misplacedTests(files: File[]): string[] {
  return files.filter((f) => f.file.endsWith(".test.ts") && !legacy(f.file))
    .filter((f) => !/^(src\/modules\/[\w-]+\/tests\/|src\/kernel\/tests\/|test\/)/.test(f.file))
    .map((f) => `${f.file}: tests live in modules/<m>/tests/, kernel/tests/ or apps/api/test/, not beside the source`);
}

/** SELECT…FROM, INSERT INTO, UPDATE <table> [[as] alias] SET <column> = (table plain, quoted or schema-qualified), DELETE FROM. */
const STATEMENT = [/\bselect\b[\s\S]*?\bfrom\b/i, /\binsert\s+into\b/i, /\bupdate\s+(only\s+)?[\w."]+(\s+(as\s+)?\w+)?\s+set\s+[\w"]+\s*=/i, /\bdelete\s+from\b/i];

/** (5) A string or template literal (placeholders as `?`) that spells a full SELECT…FROM / INSERT INTO / UPDATE…SET / DELETE FROM. */
function rawSql(files: File[]): string[] {
  return files.filter((f) => f.file.startsWith("src/") && !legacy(f.file) && !RAW_SQL_OK.includes(f.file)).flatMap((f) => {
    const sf = ts.createSourceFile(f.file, f.src, ts.ScriptTarget.Latest, true);
    const hits: string[] = [];
    const visit = (n: ts.Node) => {
      const text = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text
        : ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ? ") : null;
      if (text !== null && STATEMENT.some((r) => r.test(text))) hits.push(`${f.file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: SQL statement written by hand; use the Drizzle builder`);
      if (text === null) ts.forEachChild(n, visit);
    };
    visit(sf);
    return hits;
  });
}

const scan = (dir: string): File[] =>
  [...new Bun.Glob("**/*.ts").scanSync(path.join(ROOT, dir))].map((f) => `${dir}/${f}`).map((file) => ({ file, src: readFileSync(path.join(ROOT, file), "utf8") }));
const real = [...scan("src"), ...scan("test")];
const f = (file: string, src: string): File => ({ file, src });

describe("module boundaries (apps/api)", () => {
  it("a module is used only through its index.ts", () => {
    expect(deepImports(real)).toEqual([]);
  });

  it("kernel/ never imports modules/", () => {
    expect(kernelImports(real)).toEqual([]);
  });

  it("every table is owned by exactly one module, the database's tables included", async () => {
    const rows: { tablename: string }[] = await client`select tablename from pg_tables where schemaname = current_schema() and tablename <> 'schema_migrations'`;
    expect(rows.length).toBeGreaterThan(0);
    expect(tableOwners(real, rows.map((r) => r.tablename))).toEqual([]);
  });

  it("no test file sits beside the source", () => {
    expect(misplacedTests(real)).toEqual([]);
  });

  it("no hand-written SQL statement in src/ outside the migration runner", () => {
    expect(rawSql(real)).toEqual([]);
  });

  it("the legacy list names real paths (a stale entry fails)", () => {
    expect(LEGACY.filter((p) => !real.some((r) => (p.endsWith("/") ? r.file.startsWith(p) : r.file === p)))).toEqual([]);
  });
});

describe("module boundaries: fixtures", () => {
  it("fixture: a deep import into another module fails; its index, its own files and schema-to-schema pass", () => {
    expect(deepImports([
      f("src/modules/users/service.ts", `import { sessions } from "../auth/schema"; import { createSession } from "../auth/sessions";`),
      f("src/modules/users/controller.ts", `import { guard } from "../auth"; import { users } from "./schema"; export { x } from "../auth/index";`),
      f("src/modules/oauth/schema.ts", `import { sessions } from "../auth/schema";`),
      f("src/db/seed/demo.ts", `import { users } from "../../modules/users/schema";`),
      f("test/helpers/x.ts", `const m = await import("../../src/modules/auth/limits");`),
      f("src/db/seed/x.ts", `import { totp } from "@starterkit/api/src/modules/auth/totp.ts"; import { guard } from "@starterkit/api/src/modules/auth";`),
    ])).toEqual([
      `src/modules/users/service.ts → src/modules/auth/schema: import "src/modules/auth" (its index.ts), not its internals`,
      `src/modules/users/service.ts → src/modules/auth/sessions: import "src/modules/auth" (its index.ts), not its internals`,
      `src/db/seed/demo.ts → src/modules/users/schema: import "src/modules/users" (its index.ts), not its internals`,
      `test/helpers/x.ts → src/modules/auth/limits: import "src/modules/auth" (its index.ts), not its internals`,
      `src/db/seed/x.ts → src/modules/auth/totp: import "src/modules/auth" (its index.ts), not its internals`,
    ]);
  });

  it("fixture: kernel importing a module fails", () => {
    expect(kernelImports([f("src/kernel/plugins/x.ts", `import { guard } from "../../modules/auth";`), f("src/kernel/db.ts", `import { x } from "./config";`)]))
      .toEqual(["src/kernel/plugins/x.ts → src/modules/auth: kernel/ never imports modules/"]);
  });

  it("fixture: a table declared twice, outside a schema.ts, or only in the database fails", () => {
    expect(tableOwners([
      f("src/modules/a/schema.ts", `export const t = pgTable("things", {}); export const u = pgTable("ones", {});`),
      f("src/modules/b/schema.ts", `export const t = pgTable("things", {});`),
      f("src/modules/b/service.ts", `const tmp = pgTable("scratch", {});`),
    ], ["things", "ones", "scratch", "orphans"])).toEqual([
      "src/modules/b/service.ts: table scratch declared outside a modules/<m>/schema.ts",
      "table things owned by src/modules/a/schema.ts, src/modules/b/schema.ts",
      "table orphans exists in the database but no module owns it",
    ]);
  });

  it("fixture: a test beside a source file fails; tests/ folders and apps/api/test pass", () => {
    expect(misplacedTests([
      f("src/modules/auth/limits.test.ts", ""), f("src/kernel/config.test.ts", ""),
      f("src/modules/auth/tests/unit/totp.test.ts", ""), f("src/kernel/tests/integration/db.test.ts", ""), f("test/db/seed.test.ts", ""),
      f("src/users/users.test.ts", ""), // legacy, until Task 17
    ])).toEqual([
      "src/modules/auth/limits.test.ts: tests live in modules/<m>/tests/, kernel/tests/ or apps/api/test/, not beside the source",
      "src/kernel/config.test.ts: tests live in modules/<m>/tests/, kernel/tests/ or apps/api/test/, not beside the source",
    ]);
  });

  it("fixture: SELECT…FROM, INSERT INTO, UPDATE…SET and DELETE FROM in a string or template fail; expressions and prose pass", () => {
    expect(rawSql([
      f("src/modules/a/service.ts", [
        "const a = sql`select id from users where id = ${id}`;",
        "const b = tx`insert into activity (id) values (${id})`;",
        "const c = \"update sessions set last_seen_at = now()\";",
        "const d = sql`delete from sessions where id = ${id}`;",
        "const e = sql`array(${q}) || ${x}`; const g = sql`now() - make_interval(mins => ${n})`; const h = sql`pg_advisory_xact_lock(${k})`;",
        "const msg = \"Update your profile, then sign in.\"; // select a row from the table",
        "const i = sql`update users u set name = ${n}`;",
        "const j = sql`UPDATE public.users SET name = ${n}`;",
        "const k = sql`update \"users\" as u set name = ${n}`;",
        "const l = sql`delete from public.sessions where id = ${id}`;",
        "const m = sql`insert into public.activity (id) values (${id})`;",
        "const o = \"Update the role set before you save.\";",
      ].join("\n")),
      f("src/db/migrate.ts", "await conn`select name from schema_migrations`;"),
      f("test/helpers/db.ts", "await client`select 1 from pg_tables`;"),
    ])).toEqual([
      "src/modules/a/service.ts:1: SQL statement written by hand; use the Drizzle builder",
      "src/modules/a/service.ts:2: SQL statement written by hand; use the Drizzle builder",
      "src/modules/a/service.ts:3: SQL statement written by hand; use the Drizzle builder",
      "src/modules/a/service.ts:4: SQL statement written by hand; use the Drizzle builder",
      ...[7, 8, 9, 10, 11].map((n) => `src/modules/a/service.ts:${n}: SQL statement written by hand; use the Drizzle builder`),
    ]);
  });
});
