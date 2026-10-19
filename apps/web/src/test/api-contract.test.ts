import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_SHAPES, apiSchemas, SCHEMA_DIR, withActionTable } from "../../scripts/emit-api-schemas";
import { ACTION_LABEL } from "@/lib/shared/audit";
import { read, rel, scan, SRC } from "./scan";

/** The API contract for the backend team (docs/api): generated JSON Schemas and the endpoint table stay true. */
const DOCS = path.dirname(SCHEMA_DIR);
const README = readFileSync(path.join(DOCS, "README.md"), "utf8");

/** "METHOD /api/path" for every handler exported by a route file; `[id]` → `{id}`. */
function routesOf(files: { r: string; src: string }[]): string[] {
  return files.flatMap(({ r, src }) => {
    const url = `/api/${r.replace(/^app\/api\//, "").replace(/\/?route\.ts$/, "").replace(/\[(\w+)\]/g, "{$1}")}`;
    return [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)].map((m) => `${m[1]} ${url}`);
  });
}

/** "METHOD /api/path" for every row of the README's endpoint table. */
function documented(md: string): string[] {
  return [...md.matchAll(/^\| (GET|POST|PATCH|PUT|DELETE) \| `([^`]+)` \|/gm)].map((m) => `${m[1]} ${m[2]}`);
}

const PERM = /\b[a-z]+\.(?:view|create|edit|delete)\b/g;
/**
 * "METHOD /api/path" → what guards it, from the code: the permission names inside its `withPermission(req, …,` call
 * (sorted, comma-joined), "signed in" for `null`, or "none" when it isn't wrapped (app/api/auth/*).
 */
function guardsOf(files: { r: string; src: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { r, src } of files) {
    const url = `/api/${r.replace(/^app\/api\//, "").replace(/\/?route\.ts$/, "").replace(/\[(\w+)\]/g, "{$1}")}`;
    const hs = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)];
    hs.forEach((m, i) => {
      const body = src.slice(m.index, hs[i + 1]?.index ?? src.length);
      const arg = body.match(/withPermission\(\s*\w+\s*,\s*([^]*?),\s*async\b/)?.[1];
      out[`${m[1]} ${url}`] = arg === undefined ? "none" : arg.trim() === "null" ? "signed in" : [...new Set(arg.match(PERM))].sort().join(",");
    });
  }
  return out;
}

/** The same from the README's Permission column: backticked permissions before any "(" note; "signed in…"; anything else = none. */
function documentedGuards(md: string): Record<string, string> {
  return Object.fromEntries([...md.matchAll(/^\| (GET|POST|PATCH|PUT|DELETE) \| `([^`]+)` \| ([^|]*) \|/gm)].map((m) => {
    const cell = m[3]!.split("(")[0]!;
    const perms = [...new Set(cell.match(PERM))].sort().join(",");
    return [`${m[1]} ${m[2]}`, perms || (cell.trim().startsWith("signed in") ? "signed in" : "none")];
  }));
}

describe("API contract (docs/api)", () => {
  it("docs/api/schemas matches the zod contracts (run `bun run api:schemas` after changing a contract)", () => {
    const want = apiSchemas();
    const have = Object.fromEntries(readdirSync(SCHEMA_DIR).map((f) => [f, readFileSync(path.join(SCHEMA_DIR, f), "utf8")]));
    expect(Object.keys(have).sort()).toEqual(Object.keys(want).sort());
    for (const [file, text] of Object.entries(want)) expect(have[file], file).toBe(text);
  });

  it("the endpoint table lists every route handler under app/api, once, and nothing else", () => {
    const routes = routesOf(scan([path.join(SRC, "app/api")]).filter((f) => f.endsWith("/route.ts")).map((f) => ({ r: rel(f), src: read(f) })));
    const rows = documented(README);
    expect(rows.length).toBe(new Set(rows).size);
    expect([...rows].sort()).toEqual([...routes].sort());
    expect(README).toContain(`${rows.length} endpoints.`);
  });

  it("the Permission column matches each handler's withPermission( call", () => {
    const code = guardsOf(scan([path.join(SRC, "app/api")]).filter((f) => f.endsWith("/route.ts")).map((f) => ({ r: rel(f), src: read(f) })));
    expect(documentedGuards(README)).toEqual(code);
  });

  it("the activity action table is generated from ACTION_LABEL and has a shape for every action (run `bun run api:schemas`)", () => {
    expect(Object.keys(ACTION_SHAPES).sort()).toEqual(Object.keys(ACTION_LABEL).sort());
    expect(README).toContain("<!-- actions:start -->");
    expect(withActionTable(README)).toBe(README);
  });

  it("every schema the README links to exists", () => {
    const links = [...README.matchAll(/\]\((schemas\/[^)]+\.json)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => !existsSync(path.join(DOCS, l)))).toEqual([]);
  });

  it("guard fixtures: the Permission column check reads code and README alike, and catches a mismatch", () => {
    const files = [
      { r: "app/api/x/route.ts", src: `export async function GET(req: Request) { return withPermission(req, "user.view", async () => json(1)); }
export async function POST(req: Request) { return withPermission(req, b.ok ? "user.delete" : "user.edit", async (ctx) => json(1)); }` },
      { r: "app/api/x/[id]/route.ts", src: `export async function GET(req: Request) { return withPermission(req, null, async () => json(1)); }` },
      { r: "app/api/auth/y/route.ts", src: `export async function POST(req: Request) { return json(1); }` },
    ];
    expect(guardsOf(files)).toEqual({ "GET /api/x": "user.view", "POST /api/x": "user.delete,user.edit", "GET /api/x/{id}": "signed in", "POST /api/auth/y": "none" });
    expect(documentedGuards([
      "| GET | `/api/x` | `user.view` (recent activity needs `audit.view`) | a | b | c |",
      "| POST | `/api/x` | `user.edit`; `user.delete` for delete | a | b | c |",
      "| GET | `/api/x/{id}` | signed in (numbers need `audit.view`) | a | b | c |",
      "| POST | `/api/auth/y` | none, same-origin | a | b | c |",
    ].join("\n"))).toEqual(guardsOf(files));
    expect(documentedGuards("| GET | `/api/x` | `user.edit` | a |")).not.toEqual({ "GET /api/x": "user.view" });
  });

  it("guard fixtures: a missing or extra route and a missing method are caught", () => {
    const files = [
      { r: "app/api/users/route.ts", src: "export async function GET() {}\nexport async function POST() {}" },
      { r: "app/api/users/[id]/sessions/[sid]/route.ts", src: "export function DELETE() {}" },
    ];
    expect(routesOf(files)).toEqual(["GET /api/users", "POST /api/users", "DELETE /api/users/{id}/sessions/{sid}"]);
    expect(documented("| GET | `/api/users` | x |\n| POST | `/api/users` | x |\n| DELETE | `/api/users/{id}` | x |"))
      .toEqual(["GET /api/users", "POST /api/users", "DELETE /api/users/{id}"]);
  });
});
