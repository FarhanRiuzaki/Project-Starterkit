import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./migrate";

const url = process.env.DATABASE_URL!;
const admin = new SQL(url, { max: 1 });
let schema: string;
let db: SQL;

// Each test migrates a fresh schema (first on the search path) of the test database; `public` stays for pg_trgm.
beforeEach(async () => {
  schema = `mig_${Bun.randomUUIDv7().replaceAll("-", "")}`;
  await admin.unsafe(`create schema ${schema}`);
  db = new SQL(url, { max: 4, connection: { search_path: `${schema}, public` } });
});
afterEach(async () => {
  await db.close();
  await admin.unsafe(`drop schema ${schema} cascade`);
});

describe("migrate", () => {
  it("applies 0001 once; a second run applies nothing", async () => {
    expect(await migrate(db)).toEqual(["0001_init.sql"]);
    expect(await migrate(db)).toEqual([]);
    const [row] = await db`select count(*)::int as n from information_schema.tables where table_schema = ${schema} and table_name = 'users'`;
    expect(row.n).toBe(1);
    await db`insert into activity (id, actor_name, action, target_type, target_id, target_label) values (${Bun.randomUUIDv7()}, 'a', 'x', 't', '1', 'l')`;
    // A Bun SQL query under expect().rejects never settles (Bun 1.4.3), so catch it.
    const err = await db`update activity set action = 'y'`.catch((e: Error) => e);
    expect(String(err)).toContain("audit rows are append-only");
  });

  it("a changed applied file throws", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrations-"));
    try {
      await writeFile(join(dir, "0001_a.sql"), "create table a (x int);");
      expect(await migrate(db, dir)).toEqual(["0001_a.sql"]);
      await writeFile(join(dir, "0001_a.sql"), "create table a (x bigint);");
      await writeFile(join(dir, "0002_b.sql"), "create table b (x int);");
      await expect(migrate(db, dir)).rejects.toThrow("migration 0001_a.sql changed after it was applied");
      const [row] = await db`select count(*)::int as n from information_schema.tables where table_schema = ${schema} and table_name = 'b'`;
      expect(row.n).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("a failing file rolls back and stays pending", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrations-"));
    try {
      await writeFile(join(dir, "0001_a.sql"), "create table a (x int); select nope_not_a_function();");
      await expect(migrate(db, dir)).rejects.toThrow();
      const [row] = await db`select count(*)::int as n from information_schema.tables where table_schema = ${schema} and table_name = 'a'`;
      expect(row.n).toBe(0);
      await writeFile(join(dir, "0001_a.sql"), "create table a (x int);");
      expect(await migrate(db, dir)).toEqual(["0001_a.sql"]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("the CLI needs only a database URL, not the app secrets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "no-env-")); // a cwd without .env, so Bun loads nothing
    try {
      const p = Bun.spawn(["bun", join(import.meta.dir, "migrate.ts")], {
        cwd: dir, env: { PATH: process.env.PATH, DATABASE_URL: url, LOG_LEVEL: "silent" }, stderr: "pipe",
      });
      expect(await p.exited).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("two concurrent migrate() calls apply each file once", async () => {
    const other = new SQL(url, { max: 2, connection: { search_path: `${schema}, public` } });
    try {
      const [a, b] = await Promise.all([migrate(db), migrate(other)]);
      expect([...a, ...b]).toEqual(["0001_init.sql"]);
      const rows = await db`select name from schema_migrations`;
      expect(rows.map((r: { name: string }) => r.name)).toEqual(["0001_init.sql"]);
    } finally {
      await other.close();
    }
  });
});
