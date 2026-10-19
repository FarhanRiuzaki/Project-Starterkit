import { describe, expect, it } from "vitest";
import { oneOf, readTable, sortState, text, toSortParam, writeTable } from "./table-state";

const SPEC = {
  sorts: ["at", "login"], defaultSort: "-at",
  filters: { user: text(64), event: oneOf(["", "login_failed", "logout"] as const, ""), range: oneOf(["7d", "30d"] as const, "7d") },
};
const read = (qs: string) => readTable(new URLSearchParams(qs), SPEC);

describe("readTable", () => {
  it("defaults: page 1, 15 rows, the spec's sort, each filter's fallback", () => {
    expect(read("")).toEqual({ page: 1, pageSize: 15, sort: "-at", user: "", event: "", range: "7d" });
  });

  it("reads valid values and falls back per key on bad ones", () => {
    expect(read("page=3&pageSize=50&sort=login&user=%20ann%20&event=logout&range=30d"))
      .toEqual({ page: 3, pageSize: 50, sort: "login", user: "ann", event: "logout", range: "30d" });
    expect(read("page=0&pageSize=10&sort=-password&event=boom&range=1y"))
      .toEqual({ page: 1, pageSize: 15, sort: "-at", user: "", event: "", range: "7d" });
    expect(read("page=abc").page).toBe(1);
    expect(read("page=2.5").page).toBe(1);
    expect(read("page=99999").page).toBe(1000);
    expect(read(`user=${"x".repeat(80)}`).user).toHaveLength(64);
  });
});

describe("writeTable", () => {
  const base = read("page=4&pageSize=25&user=ann");
  it("leaves defaults out of the URL", () => {
    expect(writeTable(read(""), {}, SPEC).toString()).toBe("");
    expect(writeTable(base, { page: 5 }, SPEC).toString()).toBe("page=5&pageSize=25&user=ann");
  });

  it("any change other than the page itself goes back to page 1", () => {
    expect(writeTable(base, { user: "bob" }, SPEC).get("page")).toBeNull();
    expect(writeTable(base, { pageSize: 50 }, SPEC).get("page")).toBeNull();
    expect(writeTable(base, { sort: "login" }, SPEC).toString()).toBe("pageSize=25&sort=login&user=ann");
    expect(writeTable(base, { range: "30d" }, SPEC).get("page")).toBeNull();
  });
});

describe("sort mapping", () => {
  it("'-key' ↔ { key, dir: 'desc' }", () => {
    expect(sortState("-at")).toEqual({ key: "at", dir: "desc" });
    expect(sortState("login")).toEqual({ key: "login", dir: "asc" });
    expect(toSortParam({ key: "at", dir: "desc" })).toBe("-at");
    expect(toSortParam({ key: "login", dir: "asc" })).toBe("login");
  });
});
