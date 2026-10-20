/**
 * The test database: TEST_DATABASE_URL, else DATABASE_URL with `_test` appended to the database name. Refused unless
 * the name ends in `_test`: the tests truncate every table.
 */
export function testDatabaseUrl(env: Record<string, string | undefined>): string {
  if (!env.TEST_DATABASE_URL && !env.DATABASE_URL) throw new Error("Set TEST_DATABASE_URL, or DATABASE_URL in apps/api/.env (bun run setup).");
  const u = new URL((env.TEST_DATABASE_URL ?? env.DATABASE_URL)!);
  if (!env.TEST_DATABASE_URL && !u.pathname.endsWith("_test")) u.pathname += "_test";
  if (!u.pathname.endsWith("_test")) throw new Error("The test database name must end in _test (the tests truncate every table).");
  return u.href;
}
