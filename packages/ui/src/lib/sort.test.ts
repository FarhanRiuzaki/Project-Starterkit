import { describe, expect, it } from "vitest";
import { sortRows } from "./sort";

const rows = [{ n: "budi", v: 3 }, { n: "Andi", v: null }, { n: "citra", v: 10 }, { n: "andi", v: 3 }];

describe("sortRows", () => {
  it("angka naik, null selalu di akhir, stabil untuk nilai sama", () => {
    expect(sortRows(rows, (r) => r.v, "asc").map((r) => r.n)).toEqual(["budi", "andi", "citra", "Andi"]);
    expect(sortRows(rows, (r) => r.v, "desc").map((r) => r.n)).toEqual(["citra", "budi", "andi", "Andi"]);
  });
  it("teks tidak peka huruf, urutan Indonesia, tidak mengubah array asal", () => {
    const copy = [...rows];
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual(["Andi", "andi", "budi", "citra"]);
    expect(rows).toEqual(copy);
  });
});
