// API contract for the backend: one JSON Schema (draft 2020-12) per zod contract in src/lib/shared/contracts/*, written
// to docs/api/schemas/<Name>.json with zod's own z.toJSONSchema. Request schemas (names ending in Body or Query) are
// emitted as the client sends them (fields with a default are optional); every other schema as the server answers.
// Page answers and the two answer shapes no screen parses are composed below from the contracts.
// Usage: bun run api:schemas (rewrites the folder). src/test/api-contract.test.ts fails when the files drift.
// Limits: refinements across fields (date range, CreateUserBody password/invite, UpdateRoleBody add/remove) and the
// permission catalog check are code, not JSON Schema; docs/api/README.md states them.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as audit from "../src/lib/shared/contracts/audit";
import * as auth from "../src/lib/shared/contracts/auth";
import * as common from "../src/lib/shared/contracts/common";
import * as dashboard from "../src/lib/shared/contracts/dashboard";
import * as me from "../src/lib/shared/contracts/me";
import * as rbac from "../src/lib/shared/contracts/rbac";
import * as users from "../src/lib/shared/contracts/users";

export const SCHEMA_DIR = path.resolve(import.meta.dirname, "../../../docs/api/schemas");

/** `Page<T>` (contracts/common.ts) for one item schema. */
const pageOf = (item: z.ZodType) => z.object({
  items: z.array(item),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int(),
  totalCapped: z.boolean().optional(),
});

const COMPOSED = {
  UserPage: pageOf(users.UserDto),
  RoleOptionPage: pageOf(rbac.RoleOption),
  SessionPage: pageOf(me.SessionDto),
  RolePage: pageOf(rbac.RoleDto),
  PermissionPage: pageOf(rbac.PermissionDto),
  ActivityPage: pageOf(audit.ActivityDto),
  AuthLogPage: pageOf(audit.AuthLogDto),
  OkDto: z.object({ ok: z.literal(true) }),
  TemporaryPasswordDto: z.object({ temporaryPassword: z.string() }),
};

/** File name → file text, for every zod schema the contract modules export plus the composed ones. */
export function apiSchemas(): Record<string, string> {
  const named = [audit, auth, common, dashboard, me, rbac, users, COMPOSED].flatMap((m) => Object.entries(m));
  const out: Record<string, string> = {};
  for (const [name, schema] of named) {
    if (!(schema instanceof z.ZodType)) continue;
    const file = `${name}.json`;
    if (file in out) throw new Error(`two contracts are named ${name}`);
    const { $schema, ...json } = z.toJSONSchema(schema, { io: /(Body|Query)$/.test(name) ? "input" : "output" });
    out[file] = `${JSON.stringify({ $schema, title: name, ...json }, null, 2)}\n`;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = apiSchemas();
  rmSync(SCHEMA_DIR, { recursive: true, force: true });
  mkdirSync(SCHEMA_DIR, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(SCHEMA_DIR, file), text);
  console.log(`${Object.keys(files).length} schemas → ${path.relative(process.cwd(), SCHEMA_DIR)}`);
}
