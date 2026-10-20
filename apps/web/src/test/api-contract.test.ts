import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_SHAPES, apiSchemas, SCHEMA_DIR, withActionTable } from "../../scripts/emit-api-schemas";
import { ACTION_LABEL } from "@starterkit/shared/audit";

/**
 * The API contract (docs/api): the generated JSON Schemas and the action table stay true. The endpoint table is checked
 * against the API's routes in apps/api/test/architecture/conformance.test.ts.
 */
const DOCS = path.dirname(SCHEMA_DIR);
const README = readFileSync(path.join(DOCS, "README.md"), "utf8");

describe("API contract (docs/api)", () => {
  it("docs/api/schemas matches the zod contracts (run `bun run api:schemas` after changing a contract)", () => {
    const want = apiSchemas();
    const have = Object.fromEntries(readdirSync(SCHEMA_DIR).map((f) => [f, readFileSync(path.join(SCHEMA_DIR, f), "utf8")]));
    expect(Object.keys(have).sort()).toEqual(Object.keys(want).sort());
    for (const [file, text] of Object.entries(want)) expect(have[file], file).toBe(text);
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
});
