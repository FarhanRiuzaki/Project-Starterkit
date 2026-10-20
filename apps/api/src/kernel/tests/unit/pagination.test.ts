import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { likeEscape, sortSql } from "../../pagination";

const dialect = new PgDialect();
/** The ORDER BY text sortSql builds. */
const text = (parts: ReturnType<typeof sortSql>) => parts.map((p) => dialect.sqlToQuery(p).sql).join(", ");
const id = sql`t.id`;
const COLUMNS = { name: sql`lower(t.name)`, lastLoginAt: sql`(t.last_login_at is null), t.last_login_at` };

describe("sortSql", () => {
  it("orders by the key's expression, then id, in the same direction; undefined takes the fallback", () => {
    expect(text(sortSql("name", COLUMNS, "name", id))).toBe("lower(t.name) asc, t.id asc");
    expect(text(sortSql("-name", COLUMNS, "name", id))).toBe("lower(t.name) desc, t.id desc");
    expect(text(sortSql(undefined, COLUMNS, "-name", id))).toBe("lower(t.name) desc, t.id desc");
  });

  it("puts the direction after the whole expression (never-signed-in rows stay last both ways)", () => {
    expect(text(sortSql("-lastLoginAt", COLUMNS, "name", id))).toBe("(t.last_login_at is null), t.last_login_at desc, t.id desc");
  });

  it("refuses a key outside the whitelist, inherited names included", () => {
    for (const bad of ["password_hash", "-password_hash", "constructor", "-toString", "__proto__", "hasOwnProperty", ""]) {
      expect(() => sortSql(bad, COLUMNS, "name", id)).toThrow();
    }
  });
});

describe("likeEscape", () => {
  it("escapes the LIKE wildcards and the escape character, nothing else", () => {
    expect(likeEscape("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(likeEscape("plain text-1")).toBe("plain text-1");
  });
});
