// `bun run setup [--database-url <url>]`: env files (only when missing), the database (when missing), migrations, seeds.
// SEED_SUPERADMIN_NAME/EMAIL/USERNAME/PASSWORD from the environment go into apps/api/.env; empty = fill in later.
// Prints file names and steps only, never a value.
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDatabase } from "../apps/api/src/db/create";

const root = join(import.meta.dir, "..");
const api = join(root, "apps/api");
const apiEnv = join(api, ".env");
const webEnv = join(root, "apps/web/.env.local");
const SEED_KEYS = ["SEED_SUPERADMIN_NAME", "SEED_SUPERADMIN_EMAIL", "SEED_SUPERADMIN_USERNAME", "SEED_SUPERADMIN_PASSWORD"];

/** A .env value: bare when plain, else double-quoted with `$` and `"` escaped (Bun expands `$` even in single quotes). */
function envValue(v: string): string {
  if (/^[\w@.:/%+=-]*$/.test(v)) return v;
  if (/[\\\n\r]/.test(v)) throw new Error("A value holds a backslash or a line break; write it into the env file by hand.");
  return `"${v.replace(/[$"]/g, "\\$&")}"`;
}
const lines = (pairs: [string, string][]) => pairs.map(([k, v]) => `${k}=${envValue(v)}`).join("\n") + "\n";

/** A value of an existing .env file (as Bun reads it). */
async function readEnv(file: string, key: string): Promise<string | undefined> {
  const m = (await Bun.file(file).text()).match(new RegExp(`^${key}=(.*)$`, "m"));
  return m?.[1]?.trim().replace(/^"(.*)"$/, "$1").replace(/\\([$"])/g, "$1");
}

/** Env files hold secrets: owner read/write only. */
const writeSecret = (file: string, text: string) => writeFileSync(file, text, { mode: 0o600 });

async function run(...cmd: string[]) {
  const p = Bun.spawn(cmd, { cwd: api, stdio: ["inherit", "inherit", "inherit"] });
  if ((await p.exited) !== 0) throw new Error(`"${cmd.join(" ")}" failed`);
}

const flag = process.argv.indexOf("--database-url");
const urlArg = flag > 0 ? process.argv[flag + 1] : process.env.DATABASE_URL;
const token = randomBytes(32).toString("base64url");

if (existsSync(apiEnv)) {
  console.log("apps/api/.env exists: kept as it is.");
} else {
  if (!urlArg) throw new Error("No database: pass --database-url postgresql://user:password@host:5432/name or set DATABASE_URL.");
  writeSecret(apiEnv, "# Written by `bun run setup`. Never commit this file. Keys: apps/api/.env.example.\n" + lines([
    ["DATABASE_URL", urlArg],
    ["INTERNAL_API_TOKEN", token],
    ["DATA_ENCRYPTION_KEY", randomBytes(32).toString("base64")],
  ]) + "# Superadmin that `bun run db:seed` creates; empty = none.\n" + lines(SEED_KEYS.map((k) => [k, process.env[k] ?? ""])));
  console.log("apps/api/.env written.");
}

if (existsSync(webEnv)) {
  console.log("apps/web/.env.local exists: kept as it is. Its INTERNAL_API_TOKEN must equal the one in apps/api/.env.");
} else {
  writeSecret(webEnv, "# Written by `bun run setup`. Never commit this file.\n" + lines([
    ["API_BASE_URL", "http://127.0.0.1:4000"],
    ["INTERNAL_API_TOKEN", (await readEnv(apiEnv, "INTERNAL_API_TOKEN")) ?? token],
    ["SESSION_SECRET", randomBytes(32).toString("base64url")],
  ]));
  console.log("apps/web/.env.local written.");
}

const url = await readEnv(apiEnv, "DATABASE_URL");
if (!url) throw new Error("apps/api/.env has no DATABASE_URL.");
console.log((await createDatabase(url)) ? "Database created." : "Database exists.");
await run("bun", "run", "db:migrate");
if (existsSync(join(api, "src/seed/cli.ts"))) {
  await run("bun", "run", "db:seed");
  await run("bun", "run", "db:seed:demo");
} else {
  console.log("Seeding skipped: the seed scripts (apps/api/src/seed/cli.ts) don't exist yet.");
}
console.log("Setup done. Start web and API with `bun run dev`.");
