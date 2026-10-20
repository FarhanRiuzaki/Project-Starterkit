import { getTableColumns } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { client, db, type Tx } from "../../src/kernel/db";

/** Empties every table of the current schema except schema_migrations. */
export async function truncateAll(): Promise<void> {
  const rows: { tablename: string }[] = await client`
    select tablename from pg_tables where schemaname = current_schema() and tablename <> 'schema_migrations'`;
  if (!rows.length) return;
  await client.unsafe(`truncate table ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`);
}

/** Polls (2 s at most) until `n` other backends wait on a lock while running a query that matches `like` (ILIKE). */
export async function lockWaiters(n: number, like: string): Promise<boolean> {
  for (let i = 0; i < 100; i++) {
    const [{ c }] = await client`select count(*)::int as c from pg_stat_activity where wait_event_type = 'Lock' and query ilike ${like} and pid <> pg_backend_pid()`;
    if (c >= n) return true;
    await Bun.sleep(20);
  }
  return false;
}

/**
 * A transaction on its own pool connection for the lock-staged tests: `lock` runs in it, then it stays open, holding
 * what `lock` took, until `commit(then)` (runs `then` in it, then commits) or `rollback()` (a no-op once it ended).
 */
export async function holdTx(lock: (tx: Tx) => PromiseLike<unknown>) {
  const ROLLBACK = new Error("holdTx: rollback");
  let finish!: (then: ((tx: Tx) => PromiseLike<unknown>) | null) => void;
  const next = new Promise<((tx: Tx) => PromiseLike<unknown>) | null>((r) => (finish = r));
  let held!: () => void;
  const locked = new Promise<void>((r) => (held = r));
  const done = db.transaction(async (tx) => {
    await lock(tx);
    held();
    const then = await next;
    if (!then) throw ROLLBACK;
    await then(tx);
  }).catch((e: unknown) => {
    if (e !== ROLLBACK) throw e;
  });
  await Promise.race([locked, done]);
  return {
    commit: async (then: (tx: Tx) => PromiseLike<unknown> = async () => {}) => {
      finish(then);
      await done;
    },
    rollback: async () => {
      finish(null);
      await done;
    },
  };
}

/** A table's columns keyed by their SQL names: `db.select(sqlColumns(t))` reads rows with the keys `select *` gave. */
export const sqlColumns = (t: PgTable): Record<string, PgColumn> => Object.fromEntries(Object.values(getTableColumns(t)).map((c) => [c.name, c]));

/**
 * The rows of a Drizzle query, untyped as Bun SQL's raw rows were, so the route tests that moved off raw SQL keep
 * their assertions as they were written.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- those assertions read rows without a row type
export const rows = async (q: PromiseLike<unknown>): Promise<any[]> => (await q) as any[];
