// `bun run db:generate` (from apps/api; `-- --custom --name=<name>` for an empty file of custom SQL): drizzle-kit
// generate, then `"public".` stripped from the foreign keys it writes, so a migration runs in whatever schema is first on
// the search_path (test/db/migrate.test.ts "no migration names the public schema"). Applied files never hold it, so
// they stay byte for byte.
import { Glob } from "bun";

const kit = Bun.spawnSync(["bunx", "drizzle-kit", "generate", ...process.argv.slice(2)], { stdio: ["inherit", "inherit", "inherit"] });
if (kit.exitCode !== 0) process.exit(kit.exitCode ?? 1);
for (const file of new Glob("drizzle/*.sql").scanSync()) {
  const text = await Bun.file(file).text();
  if (text.includes('REFERENCES "public".')) await Bun.write(file, text.replaceAll('REFERENCES "public".', "REFERENCES "));
}
