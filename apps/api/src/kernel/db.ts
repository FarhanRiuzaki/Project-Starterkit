import { SQL } from "bun";
import { type BunSQLQueryResultHKT, drizzle } from "drizzle-orm/bun-sql";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { loadDbConfig } from "./config";

/**
 * The raw pool (DATABASE_URL, DB_POOL_MAX connections; `loadDbConfig` reads only those two keys). Every connection
 * starts with a 5 s statement timeout and a 10 s idle-in-transaction timeout (startup parameters through the
 * `connection` option). Only the shutdown in index.ts and the test helpers use it; app code goes through `db`.
 */
const { DATABASE_URL, DB_POOL_MAX } = loadDbConfig(process.env);
export const client = new SQL(DATABASE_URL, {
  max: DB_POOL_MAX,
  connection: { statement_timeout: 5000, idle_in_transaction_session_timeout: 10000 },
});

/** Drizzle over the pool: every query of the app is built here. */
export const db = drizzle({ client });

/** What a query runs through: `db` or a `db.transaction` callback's handle; a transaction sees its own locks. */
export type Tx = PgDatabase<BunSQLQueryResultHKT>;

/**
 * The handle inside a `db.transaction` callback (it has `rollback`, the pool does not): a write that must commit or roll
 * back with the change it describes (activity) takes this, so passing `db` fails typecheck.
 */
export type InTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
