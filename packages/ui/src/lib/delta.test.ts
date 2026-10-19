import { describe, expect, it } from "vitest";
import { deltaTone, splitDelta } from "./delta";

describe("stat tile delta", () => {
  it("splits a number-first delta into pill + caption", () => {
    expect(splitDelta("+18% vs previous 24 hours")).toEqual({ pill: "+18%", caption: "vs previous 24 hours" });
    expect(splitDelta("−12 vs 0 in previous 7 days")).toEqual({ pill: "−12", caption: "vs 0 in previous 7 days" });
    expect(splitDelta("+1,284 vs previous hour")).toEqual({ pill: "+1,284", caption: "vs previous hour" });
  });
  it("text without a leading number stays a caption", () => {
    expect(splitDelta("Same as previous 24 hours")).toEqual({ pill: null, caption: "Same as previous 24 hours" });
    expect(splitDelta("No comparison available")).toEqual({ pill: null, caption: "No comparison available" });
    expect(splitDelta("12 of 24 running")).toEqual({ pill: null, caption: "12 of 24 running" });
  });
  it("tone: good / bad per metric direction, neutral when flat or undirected", () => {
    expect(deltaTone({ direction: "up", good: "up" })).toBe("good");
    expect(deltaTone({ direction: "up", good: "down" })).toBe("bad");
    expect(deltaTone({ direction: "down", good: "down" })).toBe("good");
    expect(deltaTone({ direction: "up", good: null })).toBe("neutral");
    expect(deltaTone({ direction: "flat", good: "up" })).toBe("neutral");
  });
});
