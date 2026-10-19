import { describe, expect, it } from "vitest";
import { type NewKeysOpts, type NewKeysState, nextNewKeys, nextUntil } from "./use-new-keys";

const run = (lists: string[][], opts: NewKeysOpts | ((i: number) => NewKeysOpts) = { enabled: true }) => {
  let state: NewKeysState | null = null;
  return lists.map((k, i) => { const r = nextNewKeys(state, k, typeof opts === "function" ? opts(i) : opts); state = r.state; return [...r.fresh]; });
};

describe("nextNewKeys", () => {
  it("first non-empty list is the baseline: nothing is new", () => {
    expect(run([[], ["a", "b"]])).toEqual([[], []]);
  });
  it("a key that appears later is new once; the same keys again are not (same-data refetch)", () => {
    expect(run([["a"], ["a", "b"], ["a", "b"]])).toEqual([[], ["b"], []]);
  });
  it("reordering or paging back to seen keys is never new", () => {
    expect(run([["a", "b"], ["b", "a"], ["a"]])).toEqual([[], [], []]);
  });
  it("disabled: always empty and nothing is remembered", () => {
    expect(run([["a"], ["a", "z"]], { enabled: false })).toEqual([[], []]);
  });
  it("a scope change re-baselines: the new list and keys hidden by the old filter are not new", () => {
    const scope = (i: number) => ({ enabled: true, scope: i < 2 ? "crit" : "all" });
    expect(run([["a"], ["a"], ["a", "b", "c"], ["a", "b", "c", "d"]], scope)).toEqual([[], [], [], ["d"]]);
  });
  it("a scope change while loading (empty keys) baselines on the first rows after", () => {
    expect(run([["a"], [], ["x", "y"]], (i) => ({ enabled: true, scope: i === 0 ? "p" : "q" }))).toEqual([[], [], []]);
  });
});

describe("nextUntil", () => {
  it("expires keys whose time is up and stamps fresh ones", () => {
    const u = nextUntil(new Map([["old", 100], ["live", 500]]), new Set(["n"]), 200, 1000);
    expect([...u]).toEqual([["live", 500], ["n", 1200]]);
  });
  it("a key still held keeps its original time when it is not fresh again", () => {
    expect(nextUntil(new Map([["a", 900]]), new Set(), 100, 1000).get("a")).toBe(900);
  });
});
