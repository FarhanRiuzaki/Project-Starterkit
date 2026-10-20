import { SQL, type TransactionSQL } from "bun";
import { config } from "../config";

/**
 * The app pool (DATABASE_URL, DB_POOL_MAX connections). Every connection starts with a 5 s statement timeout and a 10 s
 * idle-in-transaction timeout (startup parameters through the `connection` option).
 */
export const sql = new SQL(config().DATABASE_URL, {
  max: config().DB_POOL_MAX,
  connection: { statement_timeout: 5000, idle_in_transaction_session_timeout: 10000 },
});

/** The handle `sql.begin(async (tx) => …)` passes to its callback. */
export type Tx = TransactionSQL;

export { migrationSql } from "./migrate";
