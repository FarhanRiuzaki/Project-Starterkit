import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import { SCRATCH } from "./tests/e2e/global-setup";

/**
 * Playwright against the real stack: the API on E2E_API_PORT (4123) over its own database, reset and seeded at
 * start, and a production build of the web on E2E_PORT (3123) in .next-e2e; never the dev servers (:3000, :4000) or
 * their .next. Desktop viewport, one worker (the database and the sign-in rate limits are shared by every test),
 * artifacts under .superpowers/scratch/ (gitignored; E2E_SCRATCH names the folder). Screenshot baselines are
 * committed next to their spec (`*.spec.ts-snapshots/`). E2E_REUSE=1 reuses servers already running on those ports.
 */
const PORT = Number(process.env.E2E_PORT ?? 3123);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4123);
const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * The E2E database: E2E_DATABASE_URL, else apps/api/.env's DATABASE_URL with `_e2e` appended to the name. Refused
 * unless the name ends in `_e2e`: the API command below drops and recreates its schema.
 */
function e2eDatabaseUrl(): string {
  const env = path.join(ROOT, "apps/api/.env");
  const fromFile = existsSync(env) ? readFileSync(env, "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^"(.*)"$/, "$1") : undefined;
  const raw = process.env.E2E_DATABASE_URL ?? fromFile;
  if (!raw) throw new Error("No E2E database: set E2E_DATABASE_URL, or run `bun run setup` (apps/api/.env).");
  const u = new URL(raw);
  if (!process.env.E2E_DATABASE_URL && !u.pathname.endsWith("_e2e")) u.pathname += "_e2e";
  if (!u.pathname.endsWith("_e2e")) throw new Error("The E2E database name must end in _e2e (its schema is dropped at start).");
  return u.href;
}

/** One random internal token and encryption key per run, shared by both servers. */
const INTERNAL_API_TOKEN = randomBytes(32).toString("base64url");
const DB = e2eDatabaseUrl();

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: path.join(SCRATCH, "test-results"),
  reporter: [["list"]],
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: [
    {
      // From the repo root: create the database when missing, drop + migrate + seed it, then serve.
      command: `bun -e 'await (await import("./apps/api/src/db/create.ts")).createDatabase(process.env.DATABASE_URL)' && bun run --filter @starterkit/api db:reset && bun apps/api/src/index.ts`,
      cwd: ROOT,
      url: `http://127.0.0.1:${API_PORT}/readyz`,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      timeout: 120_000,
      // Explicit values win over apps/api/.env, which Bun also loads: nothing here can reach the dev database.
      env: {
        NODE_ENV: "development", DATABASE_URL: DB, MIGRATION_DATABASE_URL: DB, API_HOST: "127.0.0.1", API_PORT: String(API_PORT),
        INTERNAL_API_TOKEN, DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), APP_URL: `http://localhost:${PORT}`,
        OAUTH_MOCK: "true", LDAP_MOCK: "true", MAIL_TRANSPORT: "log", LOG_LEVEL: "warn",
        SEED_SUPERADMIN_NAME: "", SEED_SUPERADMIN_EMAIL: "", SEED_SUPERADMIN_USERNAME: "", SEED_SUPERADMIN_PASSWORD: "",
      },
    },
    {
      command: `bun run build && bun run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e", SESSION_SECRET: randomBytes(32).toString("base64url"),
        API_BASE_URL: `http://127.0.0.1:${API_PORT}`, INTERNAL_API_TOKEN,
      },
    },
  ],
});
