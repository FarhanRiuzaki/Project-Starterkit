import { asc, count, desc, type SQL, sql } from "drizzle-orm";
import type { PgColumn, PgSelect } from "drizzle-orm/pg-core";
import type { Page } from "@starterkit/shared/contracts/common";
import { db } from "./db";

/** Rows counted at most; a longer list answers `total: COUNT_CAP, totalCapped: true`. */
export const COUNT_CAP = 100_000;

/** What a sort key orders by: a column, or an expression (`sql\`(${t.x} is null), ${t.x}\`` puts the direction last only). */
export type SortExpr = PgColumn | SQL;

/**
 * One page of `rows` (a `.$dynamic()` select without order or limit) and the total of `count` (the same from/where,
 * selecting a constant), both queries at once. The total stops at COUNT_CAP, so a deep count on a big table stays cheap.
 */
export async function pageQuery<Q extends PgSelect, T>(o: {
  rows: Q; count: PgSelect; orderBy: SQL[]; query: { page: number; pageSize: number }; map: (row: Awaited<Q>[number]) => T;
}): Promise<Page<T>> {
  const { page, pageSize } = o.query;
  const capped = o.count.limit(COUNT_CAP + 1).as("t");
  const [rows, [counted]] = await Promise.all([
    o.rows.orderBy(...o.orderBy).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ n: count() }).from(capped),
  ]);
  const total = counted!.n > COUNT_CAP ? { total: COUNT_CAP, totalCapped: true } : { total: counted!.n };
  return { items: (rows as Awaited<Q>).map(o.map), ...total, page, pageSize };
}

/**
 * ORDER BY for a contract sort value ("key" ascending, "-key" descending; undefined = `fallback`): `columns` maps each
 * key to a fixed column or expression, then `id` in the same direction breaks ties. A key outside `columns` throws.
 */
export function sortSql(sort: string | undefined, columns: Record<string, SortExpr>, fallback: string, id: SortExpr): SQL[] {
  const s = sort ?? fallback;
  const isDesc = s.startsWith("-");
  const key = isDesc ? s.slice(1) : s;
  const expr = Object.hasOwn(columns, key) ? columns[key] : undefined; // own keys only: never "constructor", "toString"…
  if (!expr) throw new Error(`sortSql: "${s}" is not a sort key of this list`);
  const dir = isDesc ? desc : asc;
  return [dir(expr), dir(id)];
}

/** `q` for LIKE/ILIKE '%…%' with its wildcards taken literally. */
export const likeEscape = (q: string): string => q.replace(/[\\%_]/g, "\\$&");

/** A constant select list for the `count` query of pageQuery. */
export const one = { one: sql<number>`1` };
