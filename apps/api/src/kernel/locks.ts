import { sql } from "drizzle-orm";
import type { Tx } from "./db";

/** PostgreSQL advisory lock keys (bigint), one per critical section, all here so no two sections share a key by accident. */
export const LOCKS = {
  /** db/migrate.ts: one migration runner at a time per database (session lock). */
  migrations: 7_340_211_001n,
  /** Permission catalog writes (POST /v1/permissions). */
  catalog: 50_001n,
  /** Changes that can lower the number of active Superadmins. */
  superadmin: 50_002n,
  /** The clean-up job (Task 11): one instance at a time across API processes. */
  janitor: 50_003n,
} as const;

export type LockName = keyof typeof LOCKS;

/** Takes lock `name` until `tx` commits or rolls back; a second taker waits. */
export async function xactLock(tx: Tx, name: LockName): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${LOCKS[name]})`);
}
