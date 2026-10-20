import { describe, expect, it } from "vitest";
import { goKeys, isHelpKey, matchSequence } from "./shortcuts";

const key = (k: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, ...mods });

describe("shortcuts", () => {
  it("G then a letter within a second is a sequence; later, or not after G, it isn't", () => {
    expect(matchSequence({ key: "g", at: 0 }, "u", 900)).toBe("G U");
    expect(matchSequence({ key: "g", at: 0 }, "u", 1001)).toBeNull();
    expect(matchSequence({ key: "x", at: 0 }, "u", 10)).toBeNull();
    expect(matchSequence(null, "u", 10)).toBeNull();
  });
  it("? alone opens the list; with Ctrl, Alt or Meta it doesn't", () => {
    expect(isHelpKey(key("?"))).toBe(true);
    expect(isHelpKey(key("?", { metaKey: true }))).toBe(false);
    expect(isHelpKey(key("/"))).toBe(false);
  });
  it("a shortcut's key caps", () => {
    expect(goKeys("G U")).toEqual(["G", "U"]);
    expect(goKeys("")).toEqual([]);
  });
});
