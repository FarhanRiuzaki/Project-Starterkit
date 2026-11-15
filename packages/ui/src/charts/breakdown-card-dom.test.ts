// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { BreakdownCard } from "./breakdown-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });

const empty = { title: "No sign-ins yet", description: "Sign-ins appear here after the first one." };
const first = [{ label: "Password", value: 50 }, { label: "Google", value: 30 }, { label: "Apple", value: 20 }];
async function show(props: Record<string, unknown>) {
  if (!root) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root!.render(h(TooltipProvider, null,
    h(BreakdownCard, { title: "Sign-ins by method", parts: first, otherLabel: "Other methods", empty, ...props }))));
}
const items = () => [...document.querySelectorAll<HTMLLIElement>("li")];
const labels = () => items().map((li) => li.querySelector(".truncate")!.textContent);
const flashing = () => items().filter((li) => li.className.includes("animate-row-new")).map((li) => li.querySelector(".truncate")!.textContent);
const segments = () => [...document.querySelectorAll<HTMLElement>(".chart-hbar > span")];

describe("BreakdownCard when the data changes", () => {
  it("rows that trade places keep their DOM nodes (moved, not remounted), and so do their bar segments", async () => {
    await show({});
    expect(labels()).toEqual(["Password", "Google", "Apple"]);
    const [password, google] = items();
    const [passwordSeg] = segments();
    await show({ parts: [{ label: "Password", value: 50 }, { label: "Google", value: 80 }, { label: "Apple", value: 20 }] });
    expect(labels()).toEqual(["Google", "Password", "Apple"]);
    expect(items()[0]).toBe(google);
    expect(items()[1]).toBe(password);
    expect(segments()[1]).toBe(passwordSeg);
  });
  it("the first data and a refetch of the same parts flash nothing; only a part that arrives later does", async () => {
    await show({});
    expect(flashing()).toEqual([]);
    await show({ parts: first.map((p) => ({ ...p, value: p.value + 1 })) });
    expect(flashing()).toEqual([]);
    await show({ parts: [...first, { label: "Directory", value: 40 }] });
    expect(labels()).toEqual(["Password", "Directory", "Google", "Apple"]);
    expect(flashing()).toEqual(["Directory"]);
  });
  it("a part that was folded and rises into the named rows was there all along: no wash; the folded row never gets one", async () => {
    const five = [50, 40, 30, 20, 10].map((value, i) => ({ label: `M${i}`, value }));
    await show({ parts: five.slice(0, 4), max: 4 });
    expect(labels()).toEqual(["M0", "M1", "M2", "M3"]);
    // A fifth part arrives under max 4: it folds with M3, and "Other methods" is not a new part.
    await show({ parts: five, max: 4 });
    expect(labels()).toEqual(["M0", "M1", "M2", "Other methods"]);
    expect(flashing()).toEqual([]);
    // M3 passes M1 and leaves the fold: it was in the data from the start.
    await show({ parts: five.map((p) => (p.label === "M3" ? { ...p, value: 45 } : p)), max: 4 });
    expect(labels()).toEqual(["M0", "M3", "M1", "Other methods"]);
    expect(flashing()).toEqual([]);
  });
  it("data → stale → data keeps the rows mounted (no enter replay) and shows the notice in between", async () => {
    await show({});
    const before = items();
    const barEl = document.querySelector(".chart-hbar");
    await show({ state: "stale" });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Showing previous data");
    expect(items()).toEqual(before);
    await show({});
    expect(document.querySelector('[role="status"]')).toBeNull();
    expect(items()).toEqual(before);
    expect(document.querySelector(".chart-hbar")).toBe(barEl);
  });
  it("the total read by screen readers follows the data at once", async () => {
    await show({});
    expect(document.querySelector(".sr-only")!.textContent).toBe("100");
    await show({ parts: [{ label: "Password", value: 1500 }] });
    expect(document.querySelector(".sr-only")!.textContent).toBe("1,500");
  });
  it("Try again asks the caller to retry", async () => {
    const onRetry = vi.fn();
    await show({ state: "error", onRetry });
    await act(async () => document.querySelector("button")!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
