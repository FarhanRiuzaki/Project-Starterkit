import { sql } from "../src/db/client";

/** Empties every table of the current schema except schema_migrations. */
export async function truncateAll(): Promise<void> {
  const rows: { tablename: string }[] = await sql`
    select tablename from pg_tables where schemaname = current_schema() and tablename <> 'schema_migrations'`;
  if (!rows.length) return;
  await sql.unsafe(`truncate table ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`);
}
