import { describe, expect, it } from "vitest";
import { ListQuery, MAX_PAGE, sortParam } from "@starterkit/shared/contracts/common";
import { paginate, sortRows } from "./paginate";

type R = { id: string; n: number | null; s: string };
const rows: R[] = [
  { id: "a", n: 3, s: "b" }, { id: "b", n: null, s: "a" }, { id: "c", n: 1, s: "c" }, { id: "d", n: 3, s: "d" }, { id: "e", n: 2, s: "" },
];
const SORTERS = { n: (r: R) => r.n, s: (r: R) => r.s };
const ids = (xs: R[]) => xs.map((r) => r.id);

describe("paginate", () => {
  it("slices one page and reports the total of the whole set", () => {
    expect(paginate(rows, { page: 2, pageSize: 2 }, SORTERS, "n")).toEqual({ items: [rows[0], rows[3]], total: 5, page: 2, pageSize: 2 });
    expect(paginate(rows, { page: 4, pageSize: 2 }, SORTERS, "n")).toMatchObject({ items: [], total: 5, page: 4 });
  });

  it("sorts by the requested key, both directions; empty values last both ways; ties keep input order", () => {
    expect(ids(sortRows(rows, "n", SORTERS))).toEqual(["c", "e", "a", "d", "b"]);
    expect(ids(sortRows(rows, "-n", SORTERS))).toEqual(["a", "d", "e", "c", "b"]);
    expect(ids(sortRows(rows, "-s", SORTERS))).toEqual(["d", "c", "a", "b", "e"]);
  });

  it("falls back to the default sort and refuses a key it has no sorter for", () => {
    expect(ids(paginate(rows, { page: 1, pageSize: 15 }, SORTERS, "-n").items)).toEqual(["a", "d", "e", "c", "b"]);
    expect(() => paginate(rows, { page: 1, pageSize: 15, sort: "id" }, SORTERS, "n")).toThrow();
  });

  it("equal values fall back to id order (ascending) in both directions, whatever the input order", () => {
    const tied: R[] = [{ id: "z", n: 1, s: "" }, { id: "m", n: 1, s: "" }, { id: "a", n: 1, s: "" }];
    expect(ids(sortRows(tied, "n", SORTERS))).toEqual(["a", "m", "z"]);
    expect(ids(sortRows(tied, "-n", SORTERS))).toEqual(["a", "m", "z"]);
  });

  it("does not reorder the caller's array", () => {
    const copy = [...rows];
    sortRows(rows, "-n", SORTERS);
    expect(rows).toEqual(copy);
  });
});

describe("ListQuery / sortParam (shared table contract)", () => {
  it("pageSize is 15, 25, 50 or 100 (default 15); page 1..MAX_PAGE (default 1)", () => {
    expect(ListQuery.parse({})).toMatchObject({ page: 1, pageSize: 15 });
    for (const s of ["15", "25", "50", "100"]) expect(ListQuery.parse({ pageSize: s }).pageSize).toBe(Number(s));
    for (const s of ["10", "0", "7", "x"]) expect(ListQuery.safeParse({ pageSize: s }).success).toBe(false);
    expect(MAX_PAGE).toBe(1000);
    expect(ListQuery.safeParse({ page: "1000" }).success).toBe(true);
    for (const p of ["1001", "0", "-1", "1.5"]) expect(ListQuery.safeParse({ page: p }).success).toBe(false);
  });

  it("sortParam accepts only whitelisted keys, ascending or descending", () => {
    const s = sortParam(["at", "login"]);
    for (const v of ["at", "-at", "login", "-login", undefined]) expect(s.safeParse(v).success).toBe(true);
    for (const v of ["--at", "password", "-", "", "at,login"]) expect(s.safeParse(v).success).toBe(false);
  });
});
