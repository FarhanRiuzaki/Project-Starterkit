// `bun test` preload: points the API at the test database, creates it when missing and migrates it once.
// Bun loads apps/api/.env first, so every value that could reach the dev database is overwritten here.
import { testDatabaseUrl } from "./test-url";

const url = testDatabaseUrl(process.env);
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

// After the env above: the logger reads LOG_LEVEL when it loads.
const { createDatabase, migrate } = await import("../../src/db/migrate");
await createDatabase(url);
await migrate();

export {};
