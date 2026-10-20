// `bun src/db/seed/cli.ts system | demo | reset` (root scripts db:seed, db:seed:demo, db:reset). Logs steps, never a value.
// Needs only MIGRATION_DATABASE_URL/DATABASE_URL (and SEED_SUPERADMIN_*), not the server's secrets: kernel/db.ts reads
// just the pool keys when it loads (`loadDbConfig`).
import { drizzle } from "drizzle-orm/bun-sql";
import { log } from "../../kernel/log";
import { migrationSql, resetSchema } from "../migrate";
import { seedDemo } from "./demo";
import { seedSystem } from "./system";

const cmd = process.argv[2];
if (cmd !== "system" && cmd !== "demo" && cmd !== "reset") throw new Error("Usage: bun src/db/seed/cli.ts system | demo | reset");
if (cmd === "reset" && process.env.NODE_ENV === "production") throw new Error("db:reset is refused when NODE_ENV=production.");

const raw = migrationSql();
const db = drizzle({ client: raw });
try {
  if (cmd === "reset") {
    await resetSchema(raw);
    log.info("schema dropped and migrated");
  }
  if (cmd !== "demo") {
    await seedSystem(db, process.env);
    log.info("system seed done");
  }
  if (cmd !== "system") {
    await seedDemo(db);
    log.info("demo seed done");
  }
} finally {
  await raw.close();
}
