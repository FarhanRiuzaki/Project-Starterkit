import { describe, expect, it } from "vitest";
import { niceTicks, tickLabel, yTickWidth } from "./chart-scale";

describe("niceTicks", () => {
  it("menghasilkan 3–5 tick bulat mulai 0 yang menutup nilai maksimum", () => {
    expect(niceTicks(90)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(468_000)).toEqual([0, 200_000, 400_000, 600_000]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it("seri kosong, nol, negatif, atau tidak valid tetap punya sumbu", () => {
    for (const v of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(niceTicks(v)).toEqual([0, 1]);
  });
  it("label tick ringkas", () => {
    expect(tickLabel(500_000)).toBe("500K");
    expect(tickLabel(2500)).toBe("2.5K");
    expect(tickLabel(1000)).toBe("1K");
    expect(tickLabel(1_200_000)).toBe("1.2M");
    expect(tickLabel(750)).toBe("750");
    expect(tickLabel(0)).toBe("0");
    expect(tickLabel(0.25)).toBe("0.25");
  });
});

describe("yTickWidth (spec §6.1: left padding = widest y tick + 8)", () => {
  it("grows with the widest label, plus the 8 px gap", () => {
    expect(yTickWidth(["0", "5", "10"])).toBe(24);
    expect(yTickWidth(["0", "2.5K", "5K"])).toBe(35);
    expect(yTickWidth([])).toBe(18);
    expect(yTickWidth(["600K"])).toBe(38);
  });
});
