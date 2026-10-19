import { describe, expect, it } from "vitest";
import { parsePrefs, prefsCookie } from "./prefs";

describe("prefs cookie", () => {
  it("round-trips compact density and collapsed sidebar", () => {
    const c = prefsCookie({ sidebar: "collapsed", density: "compact" }, false);
    const value = decodeURIComponent(c.split(";")[0]!.split("=")[1]!);
    expect(parsePrefs(value)).toEqual({ sidebar: "collapsed", density: "compact" });
  });
  it("missing or unknown values fall back to comfortable/expanded", () => {
    expect(parsePrefs(undefined)).toEqual({ sidebar: "expanded", density: "comfortable" });
    expect(parsePrefs("density=huge&sidebar=x")).toEqual({ sidebar: "expanded", density: "comfortable" });
  });
});
