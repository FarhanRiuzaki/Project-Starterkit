import { describe, expect, it } from "vitest";
import { mergeSeries } from "./chart-data";

describe("mergeSeries", () => {
  it("merges series by timestamp, sorted", () => {
    const rows = mergeSeries([
      { key: "s0", points: [[120, 2], [60, 1]] },
      { key: "s1", points: [[60, 5]] },
    ]);
    expect(rows).toEqual([{ t: 60, s0: 1, s1: 5 }, { t: 120, s0: 2 }]);
  });
  it("returns empty for no points", () => {
    expect(mergeSeries([{ key: "s0", points: [] }])).toEqual([]);
  });
});
