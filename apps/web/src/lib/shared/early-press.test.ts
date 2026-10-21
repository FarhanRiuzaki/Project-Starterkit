// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EARLY_PRESS_MAX_AGE_MS, EARLY_PRESS_SCRIPT } from "./early-press";

/** The script's 50 ms checks, run by hand: `frame()` plays the next one. */
const queue: (() => void)[] = [];
const frame = () => queue.shift()?.();
let got: string[] = [];
let commit: () => void;

beforeAll(() => {
  // Once, as the page's <head> does; its timer is the queue (the page's own timers stay real).
  new Function("setTimeout", EARLY_PRESS_SCRIPT)((cb: () => void) => queue.push(cb));
  commit = (window as unknown as { __earlyPressCommitted: () => void }).__earlyPressCommitted;
});
// The page goes first, so a pending check finds its button gone and stops.
afterEach(() => { document.body.innerHTML = ""; while (queue.length) frame(); vi.useRealTimers(); });

/** Builds the DOM given; every button logs what reaches it. */
function page(html: string) {
  document.body.innerHTML = html;
  for (const b of document.querySelectorAll("button")) for (const t of ["pointerdown", "click"]) b.addEventListener(t, () => got.push(`${b.id}:${t}`));
  got = [];
}
const el = (id: string) => document.getElementById(id) as HTMLButtonElement;
/** What React DOM puts on a node it handles events for. */
const hydrate = (id: string) => { (el(id) as unknown as Record<string, unknown>)["__reactProps$x1"] = {}; };
const press = (id: string) => { el(id).click(); got = []; };

describe("early press", () => {
  // Runs first: the root has not committed yet.
  it("until the root commits, a press is kept even on a button React has rendered (React drops it then)", () => {
    page(`<button id="a">A</button>`);
    hydrate("a");
    press("a");
    expect(queue).toHaveLength(1);
  });

  it("the last press on a button not handled yet is pressed again once, pointer down then click, when React handles it", () => {
    page(`<button id="a">A</button><button id="b"><span id="in">B</span></button>`);
    press("a");
    document.getElementById("in")!.click();
    got = [];
    frame();
    expect(got).toEqual([]); // not hydrated yet: check again later
    hydrate("a");
    hydrate("b");
    frame();
    expect(got).toEqual([]); // rendered, but the root has not committed
    commit();
    frame();
    expect(got).toEqual(["b:pointerdown", "b:click"]);
    expect(queue).toHaveLength(0);
  });

  it("a press on a button React already handles is left alone", () => {
    page(`<button id="a">A</button>`);
    hydrate("a");
    press("a");
    expect(queue).toHaveLength(0);
  });

  it("dropped: a press too old by the time the button hydrates, a button gone or disabled, a form's submit button", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    page(`<button id="a">A</button>`);
    press("a");
    vi.setSystemTime(Date.now() + EARLY_PRESS_MAX_AGE_MS + 1);
    hydrate("a");
    frame();
    expect(got).toEqual([]);
    vi.useRealTimers();

    page(`<button id="a">A</button>`);
    press("a");
    el("a").remove();
    frame();
    expect(got).toEqual([]);

    page(`<button id="a">A</button>`);
    press("a");
    el("a").disabled = true;
    hydrate("a");
    frame();
    expect(got).toEqual([]);

    page(`<form><input><button id="s">Sign in</button></form>`);
    el("s").addEventListener("click", (e) => e.preventDefault()); // the browser's own submit, out of the test
    press("s");
    expect(queue).toHaveLength(0);
  });
});
