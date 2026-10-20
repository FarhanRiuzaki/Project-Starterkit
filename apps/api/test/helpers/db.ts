import { client } from "../../src/kernel/db";

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
