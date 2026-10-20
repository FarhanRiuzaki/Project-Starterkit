// Transitional: the raw-SQL pager of the Hono list routes (users, rbac, audit) until Tasks 17–18; new code uses
// kernel/pagination.ts.
import type { SQL } from "bun";
import type { Page } from "@starterkit/shared/contracts/common";
import { COUNT_CAP } from "../kernel/pagination";
import { sql } from "./client";

export { COUNT_CAP, likeEscape } from "../kernel/pagination";

/** A piece of SQL built with sql`…` (parameters stay parameters) to splice into another query. */
export type Fragment = SQL.Query<unknown>;

/**
 * One page of `select <select> <from> order by <orderBy>` and its total, both queries at once. The total stops at
 * COUNT_CAP, so a deep count on a big table stays cheap.
 */
export async function pageQuery<R, T>(o: {
  select: Fragment; from: Fragment; orderBy: Fragment; query: { page: number; pageSize: number }; map: (row: R) => T;
}): Promise<Page<T>> {
  const { page, pageSize } = o.query;
  const [rows, [count]] = await Promise.all([
    sql<R[]>`select ${o.select} ${o.from} order by ${o.orderBy} limit ${pageSize} offset ${(page - 1) * pageSize}`,
    sql<{ n: number }[]>`select count(*)::int as n from (select 1 ${o.from} limit ${COUNT_CAP + 1}) t`,
  ]);
  const total = count!.n > COUNT_CAP ? { total: COUNT_CAP, totalCapped: true } : { total: count!.n };
  return { items: rows.map(o.map), ...total, page, pageSize };
}

/**
 * ORDER BY for a contract sort value ("key" ascending, "-key" descending; undefined = `fallback`): `columns` maps each
 * key to a fixed SQL expression, then `id` in the same direction breaks ties. A key outside `columns` throws.
 */
export function sortSql(sort: string | undefined, columns: Record<string, string>, fallback: string): Fragment {
  const s = sort ?? fallback;
  const desc = s.startsWith("-");
  const key = desc ? s.slice(1) : s;
  const expr = Object.hasOwn(columns, key) ? columns[key] : undefined; // own keys only: never "constructor", "toString"…
  if (!expr) throw new Error(`sortSql: "${s}" is not a sort key of this list`);
  const dir = desc ? "desc" : "asc";
  return sql.unsafe(`${expr} ${dir}, id ${dir}`);
}
