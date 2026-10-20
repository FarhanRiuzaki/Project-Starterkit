// `bun test` preload: points the API at the test database, creates it when missing and migrates it once.
// Bun loads apps/api/.env first, so every value that could reach the dev database is overwritten here.
import { createDatabase } from "../src/db/create";

/** The test database: TEST_DATABASE_URL, else DATABASE_URL with `_test` appended to the database name. */
function testUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error("Set TEST_DATABASE_URL, or DATABASE_URL in apps/api/.env (bun run setup).");
  const u = new URL(process.env.DATABASE_URL);
  if (!u.pathname.endsWith("_test")) u.pathname += "_test";
  return u.href;
}

const url = testUrl();
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: url,
  MIGRATION_DATABASE_URL: url,
  INTERNAL_API_TOKEN: "test-internal-token-0123456789abcdef",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString("base64"),
  OAUTH_MOCK: "true",
  LDAP_MOCK: "true",
  MAIL_TRANSPORT: "log",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? "silent",
});

await createDatabase(url);
// After the env above: migrate.ts reads config() when it loads.
const { migrate } = await import("../src/db/migrate");
await migrate();
