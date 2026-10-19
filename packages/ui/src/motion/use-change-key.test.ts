import { describe, expect, it } from "vitest";
import { nextChangeKey } from "./use-change-key";

const fold = (values: unknown[]) => {
  let s: { value: unknown; n: number } | null = null;
  return values.map((v) => { s = nextChangeKey(s, v); return s.n; });
};

describe("nextChangeKey", () => {
  it("the same value keeps n at 0", () => expect(fold(["a", "a"])).toEqual([0, 0]));
  it("a change increments n", () => expect(fold(["a", "b"])).toEqual([0, 1]));
  it("returning to an earlier value is still a change", () => expect(fold(["a", "b", "a"])).toEqual([0, 1, 2]));
  it("objects compare by content, not identity", () => expect(fold([{ x: 1 }, { x: 1 }])).toEqual([0, 0]));
  it("objects with different content change", () => expect(fold([[1], [1, 2]])).toEqual([0, 1]));
});
