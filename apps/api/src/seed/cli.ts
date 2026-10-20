// `bun src/seed/cli.ts system | demo | reset` (root scripts db:seed, db:seed:demo, db:reset). Logs steps, never a value.
import { config } from "../config";
import { migrate, migrationSql } from "../db/migrate";
import { log } from "../log";
import { seedDemo } from "./demo";
import { seedSystem } from "./system";

const cmd = process.argv[2];
if (cmd !== "system" && cmd !== "demo" && cmd !== "reset") throw new Error("Usage: bun src/seed/cli.ts system | demo | reset");
if (cmd === "reset" && config().NODE_ENV === "production") throw new Error("db:reset is refused when NODE_ENV=production.");

const db = migrationSql();
try {
  if (cmd === "reset") {
    await db.unsafe("drop schema public cascade; create schema public;");
    await migrate(db);
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
  await db.close();
}
