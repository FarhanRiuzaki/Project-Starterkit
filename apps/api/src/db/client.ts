// Transitional: the raw pool and transaction type of the Hono routes not yet moved to modules (deleted in Task 18).
import type { SQL, TransactionSQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { client, type Tx as Db } from "../kernel/db";

/** The app pool as raw SQL, for the Hono routes until their module moves. */
export const sql = client;

/** The handle `sql.begin(async (tx) => …)` passes to its callback. */
export type Tx = TransactionSQL;

/** Drizzle over a raw handle (a `sql.begin` transaction or the pool), so a module function joins that transaction. */
export const orm = (raw: SQL): Db => drizzle({ client: raw });
