import { describe, expect, it } from "vitest";
import { historyMode, isoDate, oneOf, readTable, sortState, text, toSortParam, writeTable } from "./table-state";

const SPEC = {
  sorts: ["at", "login"], defaultSort: "-at", search: ["user"] as const,
  filters: { user: text(64), event: oneOf(["", "login_failed", "logout"] as const, ""), range: oneOf(["7d", "30d"] as const, "7d"), from: isoDate },
};
const read = (qs: string) => readTable(new URLSearchParams(qs), SPEC);

describe("readTable", () => {
  it("defaults: page 1, 15 rows, the spec's sort, each filter's fallback", () => {
    expect(read("")).toEqual({ page: 1, pageSize: 15, sort: "-at", user: "", event: "", range: "7d", from: "" });
  });

  it("reads valid values and falls back per key on bad ones", () => {
    expect(read("page=3&pageSize=50&sort=login&user=%20ann%20&event=logout&range=30d"))
      .toEqual({ page: 3, pageSize: 50, sort: "login", user: "ann", event: "logout", range: "30d", from: "" });
    expect(read("page=0&pageSize=10&sort=-password&event=boom&range=1y"))
      .toEqual({ page: 1, pageSize: 15, sort: "-at", user: "", event: "", range: "7d", from: "" });
    expect(read("page=abc").page).toBe(1);
    expect(read("page=2.5").page).toBe(1);
    expect(read("page=99999").page).toBe(1000);
    expect(read(`user=${"x".repeat(80)}`).user).toHaveLength(64);
    expect(read("from=2026-02-28").from).toBe("2026-02-28");
    for (const d of ["2026-02-30", "2026-2-1", "20261001", "2026-10-01T00:00", "x"]) expect(read(`from=${d}`).from).toBe("");
  });
});

describe("writeTable", () => {
  const base = read("page=4&pageSize=25&user=ann");
  it("leaves defaults out of the URL", () => {
    expect(writeTable(read("page=2"), { page: 1 }, SPEC)!.toString()).toBe("");
    expect(writeTable(base, { page: 5 }, SPEC)!.toString()).toBe("page=5&pageSize=25&user=ann");
  });

  it("any change other than the page itself goes back to page 1", () => {
    expect(writeTable(base, { user: "bob" }, SPEC)!.get("page")).toBeNull();
    expect(writeTable(base, { pageSize: 50 }, SPEC)!.get("page")).toBeNull();
    expect(writeTable(base, { sort: "login" }, SPEC)!.toString()).toBe("pageSize=25&sort=login&user=ann");
    expect(writeTable(base, { range: "30d" }, SPEC)!.get("page")).toBeNull();
  });
});

describe("writeTable: nothing changed, normalised values", () => {
  const base = read("page=4&user=ann");
  it("is null (no navigation, no page reset) when the patch changes nothing", () => {
    expect(writeTable(base, {}, SPEC)).toBeNull();
    expect(writeTable(base, { page: 4 }, SPEC)).toBeNull();
    expect(writeTable(base, { user: "ann" }, SPEC)).toBeNull();
    expect(writeTable(base, { user: "  ann " }, SPEC)).toBeNull(); // trimmed before comparing
  });
  it("writes filter values through their parser (trimmed text, valid choice or fallback)", () => {
    expect(writeTable(base, { user: "  bob  " }, SPEC)!.get("user")).toBe("bob");
    expect(writeTable(base, { event: "boom" as never }, SPEC)).toBeNull(); // falls back to "", which it already is
  });
});

describe("historyMode", () => {
  it("search keystrokes replace the history entry; every other committed change pushes one (Back undoes it)", () => {
    expect(historyMode({ user: "ann" }, SPEC)).toBe("replace");
    expect(historyMode({ page: 2 }, SPEC)).toBe("push");
    expect(historyMode({ event: "logout" }, SPEC)).toBe("push");
    expect(historyMode({ user: "ann", page: 1 }, SPEC)).toBe("push");
    expect(historyMode({ user: "ann" }, { ...SPEC, search: undefined })).toBe("push");
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
