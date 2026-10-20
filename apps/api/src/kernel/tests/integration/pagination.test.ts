import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { COUNT_CAP, likeEscape, one, pageQuery, sortSql } from "../../pagination";

const ids = Array.from({ length: 5 }, () => Bun.randomUUIDv7()).sort(); // ascending
// Five rows, all named "same" except one: sorting by name alone leaves the order of the ties open.
const from = sql`(values (${ids[3]}::uuid, 'same'), (${ids[0]}::uuid, 'same'), (${ids[4]}::uuid, 'b'), (${ids[1]}::uuid, 'same'), (${ids[2]}::uuid, 'same')) as t(id, name)`;
const at = (...ix: number[]) => ix.map((i) => ids[i]!);
const t = { id: sql<string>`t.id`, name: sql<string>`t.name` };
const COLUMNS = { name: t.name, id: t.id };
const list = (sort: string | undefined, page: number, pageSize: number) =>
  pageQuery({
    rows: db.select({ id: t.id, name: t.name }).from(from).$dynamic(), count: db.select(one).from(from).$dynamic(),
    orderBy: sortSql(sort, COLUMNS, "name", t.id), query: { page, pageSize }, map: (r) => r.id,
  });

describe("pageQuery", () => {
  it("page past the end has empty items and the real total", async () => {
    expect(await list("name", 3, 15)).toEqual({ items: [], total: 5, page: 3, pageSize: 15 });
    expect((await list("name", 1, 2)).items).toHaveLength(2);
  });

  it("ties broken by id", async () => {
    expect((await list("name", 1, 15)).items).toEqual(at(4, 0, 1, 2, 3));
    expect((await list("-name", 1, 15)).items).toEqual(at(3, 2, 1, 0, 4));
    expect((await list(undefined, 2, 2)).items).toEqual(at(1, 2)); // fallback "name"
  });

  it("caps the count at COUNT_CAP", async () => {
    const series = sql`generate_series(1, ${COUNT_CAP + 5}) as t(id)`;
    const id = sql<number>`t.id`;
    const p = await pageQuery({
      rows: db.select({ id }).from(series).$dynamic(), count: db.select(one).from(series).$dynamic(),
      orderBy: sortSql("-id", COLUMNS, "id", id), query: { page: 1, pageSize: 2 }, map: (r) => r.id,
    });
    expect(p).toEqual({ items: [COUNT_CAP + 5, COUNT_CAP + 4], total: COUNT_CAP, page: 1, pageSize: 2, totalCapped: true });
  });

  it("sortSql refuses a key outside the whitelist; likeEscape escapes \\ % _", async () => {
    expect(() => sortSql("password_hash", COLUMNS, "name", t.id)).toThrow();
    for (const inherited of ["constructor", "-toString", "__proto__", "hasOwnProperty"]) expect(() => sortSql(inherited, COLUMNS, "name", t.id)).toThrow();
    expect(likeEscape("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    const [r] = await db.execute(sql`select ${"a50%_x"} like ${`%${likeEscape("50%_")}%`} as hit, ${"a50xyx"} like ${`%${likeEscape("50%_")}%`} as miss`);
    expect(r).toEqual({ hit: true, miss: false });
  });
});
