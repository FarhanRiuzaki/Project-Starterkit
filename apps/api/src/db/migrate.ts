import { SQL } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { LOCKS } from "../kernel/locks";
import { log } from "../kernel/log";

/**
 * One connection as the schema owner (MIGRATION_DATABASE_URL, else DATABASE_URL), no statement timeout; the caller
 * closes it. Reads only those two keys, so `db:migrate` runs without the app's secrets.
 */
export function migrationSql(): SQL {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_DATABASE_URL or DATABASE_URL to migrate.");
  return new SQL(url, { max: 1 });
}

/** drizzle-kit's output (generated from every modules/<m>/schema.ts, plus custom SQL); meta/ is drizzle-kit's own. */
const DIR = join(import.meta.dir, "../../drizzle");

/**
 * Applies the pending `NNNN_name.sql` files of `dir` in name order, each in its own transaction, under a session
 * advisory lock (concurrent runners wait, then see the files as applied). Returns the names applied. An applied file
 * whose SHA-256 changed throws before anything runs. Without `db`, opens and closes a MIGRATION_DATABASE_URL connection.
 */
export async function migrate(db?: SQL, dir = DIR): Promise<string[]> {
  const pool = db ?? migrationSql();
  try {
    const conn = await pool.reserve();
    try {
      await conn`select pg_advisory_lock(${LOCKS.migrations})`;
      try {
        return await applyPending(conn, dir);
      } finally {
        // A failed unlock (a broken connection drops the lock anyway) must not hide the error above.
        await conn`select pg_advisory_unlock(${LOCKS.migrations})`.catch(() => {});
      }
    } finally {
      conn.release();
    }
  } finally {
    if (!db) await pool.close();
  }
}

async function applyPending(conn: SQL, dir: string): Promise<string[]> {
  await conn`create table if not exists schema_migrations (
    name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
  const done = new Map<string, string>();
  for (const r of await conn`select name, checksum from schema_migrations`) done.set(r.name, r.checksum);
  const files = (await readdir(dir)).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  const pending: { name: string; text: string; checksum: string }[] = [];
  for (const name of files) {
    const text = await Bun.file(join(dir, name)).text();
    const checksum = new Bun.CryptoHasher("sha256").update(text).digest("hex");
    if (!done.has(name)) pending.push({ name, text, checksum });
    else if (done.get(name) !== checksum) throw new Error(`migration ${name} changed after it was applied`);
  }
  for (const m of pending) {
    await conn.begin(async (tx) => {
      await tx.unsafe(m.text);
      await tx`insert into schema_migrations (name, checksum) values (${m.name}, ${m.checksum})`;
    });
    log.info({ migration: m.name }, "migration applied");
  }
  return pending.map((m) => m.name);
}

/** Creates the database `url` names when it doesn't exist, connecting to the server's `postgres` database. */
export async function createDatabase(url: string): Promise<boolean> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  target.pathname = "/postgres";
  const server = new SQL(target.href, { max: 1 });
  try {
    const [found] = await server`select 1 from pg_database where datname = ${name}`;
    if (found) return false;
    await server.unsafe(`create database "${name.replaceAll('"', '""')}"`);
    return true;
  } finally {
    await server.close();
  }
}

/** Drops every object of the `public` schema (db:reset; the caller refuses production), then migrates it again. */
export async function resetSchema(db: SQL): Promise<string[]> {
  await db.unsafe("drop schema public cascade; create schema public;");
  return migrate(db);
}

if (import.meta.main) {
  const applied = await migrate();
  log.info({ applied: applied.length }, applied.length ? "migrations done" : "no pending migrations");
}
