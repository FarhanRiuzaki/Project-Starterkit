import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { apiSchemas, SCHEMA_DIR } from "../../scripts/emit-api-schemas";
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

  it("every schema the README links to exists", () => {
    const links = [...README.matchAll(/\]\((schemas\/[^)]+\.json)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => !existsSync(path.join(DOCS, l)))).toEqual([]);
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
