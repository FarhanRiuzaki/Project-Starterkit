import { SQL } from "bun";
import { type BunSQLQueryResultHKT, drizzle } from "drizzle-orm/bun-sql";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { config } from "./config";

/**
 * The raw pool (DATABASE_URL, DB_POOL_MAX connections). Every connection starts with a 5 s statement timeout and a 10 s
 * idle-in-transaction timeout (startup parameters through the `connection` option). Only the shutdown in index.ts and
 * the test helpers use it; app code goes through `db`.
 */
export const client = new SQL(config().DATABASE_URL, {
  max: config().DB_POOL_MAX,
  connection: { statement_timeout: 5000, idle_in_transaction_session_timeout: 10000 },
});

/** Drizzle over the pool: every query of the app is built here. */
export const db = drizzle({ client });

/** What a query runs through: `db` or a `db.transaction` callback's handle; a transaction sees its own locks. */
export type Tx = PgDatabase<BunSQLQueryResultHKT>;
