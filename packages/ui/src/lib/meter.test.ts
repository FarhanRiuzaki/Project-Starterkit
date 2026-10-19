import { describe, expect, it } from "vitest";
import { clampRatio, meterTone, tickState } from "./meter";

describe("meter", () => {
  it("ambang 80% dan 90%", () => {
    expect(meterTone(0.79)).toBe("normal");
    expect(meterTone(0.8)).toBe("warn");
    expect(meterTone(0.9)).toBe("crit");
    expect(meterTone(null)).toBe("normal");
  });
  it("rasio dijepit ke 0–1 dan nilai tidak valid jadi 0", () => {
    expect(clampRatio(1.4)).toBe(1);
    expect(clampRatio(-1)).toBe(0);
    expect(clampRatio(Number.NaN)).toBe(0);
    expect(clampRatio(null)).toBe(0);
  });
});

describe("tick meter", () => {
  it("fills round(ratio × count) ticks", () => {
    expect(tickState(0.62, 32).filled).toBe(20);
    expect(tickState(0, 32).filled).toBe(0);
    expect(tickState(1.5, 32).filled).toBe(32);
    expect(tickState(null, 24).filled).toBe(0);
  });
  it("threshold tick sits at the tick that reaches the threshold", () => {
    expect(tickState(0.5, 40, 0.8).threshold).toBe(31);
    expect(tickState(0.5, 40, 1).threshold).toBe(39);
    expect(tickState(0.5, 40, 0).threshold).toBe(0);
    expect(tickState(0.5, 40).threshold).toBeNull();
  });
  it("count is clamped to 24–40 (spec §5.10)", () => {
    expect(tickState(0.5, 10).count).toBe(24);
    expect(tickState(0.5, 100).count).toBe(40);
    expect(tickState(0.5, Number.NaN).count).toBe(32);
  });
});
