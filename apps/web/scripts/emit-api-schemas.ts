// API contract for the backend: one JSON Schema (draft 2020-12) per zod contract in packages/shared/src/contracts/*, written
// to docs/api/schemas/<Name>.json with zod's own z.toJSONSchema. Request schemas (names ending in Body or Query) are
// emitted as the client sends them (fields with a default are optional); every other schema as the server answers.
// Page answers and the two answer shapes no screen parses are composed below from the contracts.
// It also rewrites the activity action table in docs/api/README.md (between the actions:start/end markers) from the
// action vocabulary (ACTION_LABEL) and the before/after shapes below.
// Usage: bun run api:schemas (rewrites the folder and the table). src/test/api-contract.test.ts fails when either drifts.
// Limits: refinements across fields (date range, CreateUserBody password/invite, UpdateRoleBody add/remove) and the
// permission catalog check are code, not JSON Schema; docs/api/README.md states them.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ACTION_LABEL } from "@starterkit/shared/audit";
import * as audit from "@starterkit/shared/contracts/audit";
import * as auth from "@starterkit/shared/contracts/auth";
import * as common from "@starterkit/shared/contracts/common";
import * as dashboard from "@starterkit/shared/contracts/dashboard";
import * as me from "@starterkit/shared/contracts/me";
import * as rbac from "@starterkit/shared/contracts/rbac";
import * as users from "@starterkit/shared/contracts/users";

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
  UserPage: pageOf(users.UserRowDto),
  RoleOptionPage: pageOf(rbac.RoleOption),
  SessionPage: pageOf(me.SessionDto),
  SavedViewPage: pageOf(me.SavedViewDto),
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

/** Target type and before / after of each activity action, as the routes record them ("–" = null). */
export const ACTION_SHAPES: Record<string, [target: string, before: string, after: string]> = {
  "user.create": ["user", "–", "the new user ([UserDto](schemas/UserDto.json)) + `invited: boolean`"],
  "user.update": ["user", "changed fields only, of `name`, `username`, `email`, `roles`", "the same fields, new values"],
  "user.activate": ["user", "`{ isActive: false }`", "`{ isActive: true }`"],
  "user.deactivate": ["user", "`{ isActive: true }`", "`{ isActive: false }`"],
  "user.delete": ["user", "the user ([UserDto](schemas/UserDto.json))", "–"],
  "user.assign_role": ["user", "`{ roles }`", "`{ roles }` (bulk assign)"],
  "user.reset_password": ["user", "–", "– (the temporary password is never recorded)"],
  "user.session_end": ["user", "–", "`{ session: device }`"],
  "role.create": ["role", "–", "`{ name, added: permissions, removed: [] }`"],
  "role.update": ["role", "`{ name }` (before)", "`{ name, added, removed }` (effective change only)"],
  "role.delete": ["role", "`{ name, permissions }`", "–"],
  "permission.create": ["permission (id and label: the new names, comma-joined)", "–", "`{ created: names }`"],
  "me.update": ["user (self)", "`{ name, email }`", "`{ name, email }`"],
  "me.password": ["user (self)", "–", "–"],
  "me.connect": ["user (self)", "–", "`{ provider }`"],
  "me.disconnect": ["user (self)", "`{ provider }`", "–"],
  "me.session_end": ["session (label: device)", "–", "–"],
  "me.2fa_setup": ["user (self)", "–", "– (the secret is never recorded)"],
  "me.2fa_enable": ["user (self)", "–", "– (recovery codes are never recorded)"],
  "me.2fa_disable": ["user (self)", "–", "–"],
};

export const README = path.join(path.dirname(SCHEMA_DIR), "README.md");
const MARK = /(<!-- actions:start -->\n)[\s\S]*?(<!-- actions:end -->)/;

/** The action table: one row per action of ACTION_LABEL, in that order. */
export function actionTable(): string {
  const rows = Object.entries(ACTION_LABEL).map(([action, label]) => {
    const shape = ACTION_SHAPES[action];
    if (!shape) throw new Error(`no ACTION_SHAPES entry for ${action}`);
    return `| \`${action}\` | ${label} | ${shape.join(" | ")} |`;
  });
  return ["| Action | Label | Target | `before` | `after` |", "|---|---|---|---|---|", ...rows, ""].join("\n");
}

/** README text with the action table regenerated. */
export const withActionTable = (md: string) => md.replace(MARK, (_, start: string, end: string) => `${start}${actionTable()}${end}`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = apiSchemas();
  rmSync(SCHEMA_DIR, { recursive: true, force: true });
  mkdirSync(SCHEMA_DIR, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(SCHEMA_DIR, file), text);
  writeFileSync(README, withActionTable(readFileSync(README, "utf8")));
  console.log(`${Object.keys(files).length} schemas → ${path.relative(process.cwd(), SCHEMA_DIR)}; action table → ${path.relative(process.cwd(), README)}`);
}
