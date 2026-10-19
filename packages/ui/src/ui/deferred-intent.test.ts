import { describe, expect, it } from "vitest";
import { INTENT_MAX_AGE_MS, opensOnKey, opensOnPointer, takeIntent } from "./deferred-intent";

/** The twin trigger opens exactly when the Radix trigger it stands in for would (closed state). */
describe("deferred trigger intent (menu: Radix DropdownMenu.Trigger, closed)", () => {
  it("primary-button pointer down opens a menu; other buttons and ctrl-click (macOS context click) don't", () => {
    expect(opensOnPointer("menu", { button: 0, ctrlKey: false })).toBe(true);
    expect(opensOnPointer("menu", { button: 2, ctrlKey: false })).toBe(false);
    expect(opensOnPointer("menu", { button: 0, ctrlKey: true })).toBe(false);
  });
  it("Enter, Space and ArrowDown open a menu; other keys don't", () => {
    for (const key of ["Enter", " ", "ArrowDown"]) expect(opensOnKey("menu", key), key).toBe(true);
    for (const key of ["ArrowUp", "Tab", "Escape", "a"]) expect(opensOnKey("menu", key), key).toBe(false);
  });
});

describe("deferred trigger intent (dialog: Radix Popover.Trigger, closed)", () => {
  it("opens on click only (the button's own click, also fired by Enter and Space)", () => {
    expect(opensOnPointer("dialog", { button: 0, ctrlKey: false })).toBe(false);
    expect(opensOnKey("dialog", "Enter")).toBe(false);
    expect(opensOnKey("dialog", "ArrowDown")).toBe(false);
  });
});

/** A press on the stand-in is honoured once, when the chunk arrives, and only while it is still recent. */
describe("pending press (takeIntent)", () => {
  it("returns how the overlay was asked to open when the chunk arrives soon after the press", () => {
    expect(takeIntent({ how: "key", at: 1000 }, 1500)).toBe("key");
    expect(takeIntent({ how: "pointer", at: 1000 }, 1000 + INTENT_MAX_AGE_MS)).toBe("pointer");
  });
  it("no press, or a press older than INTENT_MAX_AGE_MS (the user moved on), opens nothing", () => {
    expect(takeIntent(null, 5000)).toBeNull();
    expect(takeIntent({ how: "key", at: 1000 }, 1001 + INTENT_MAX_AGE_MS)).toBeNull();
  });
});
