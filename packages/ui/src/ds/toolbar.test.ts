// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { filterSheetLoader } from "./filter-sheet";
import { FilterMenu, Toolbar, ToolbarFilters } from "./toolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STATUSES = [{ value: "", label: "Any" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] as const;
const tree = (active: number, onChange: (v: string) => void = () => {}) => h(Toolbar, null,
  h("input", { "aria-label": "Search users" }),
  h(ToolbarFilters, { active, children: h(FilterMenu<string>, { label: "Status", value: "active", options: STATUSES, onChange }) }));

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

/** Toolbar on a phone (responsive spec "Toolbar filter"): the search stays, the other filters move to a sheet. */
describe("ToolbarFilters", () => {
  it("inline from md (hidden below), and a phone-only Filters button with the active count", () => {
    const out = renderToStaticMarkup(tree(2));
    expect(out).toMatch(/<div data-slot="toolbar-filters" class="contents max-md:hidden"><button[^>]*aria-label="Status: Active"/);
    const button = /<button([^>]*data-slot="filter-sheet-trigger"[^>]*)>(.*?)<\/button>/.exec(out);
    expect(button?.[1]).toMatch(/class="[^"]*md:hidden/);
    expect(button?.[1]).toContain('aria-label="Filters, 2 active"');
    expect(button?.[1]).toContain('aria-haspopup="dialog"');
    expect(button?.[2]).toMatch(/^Filters<span data-slot="count-badge"[^>]*>2<\/span>$/);
  });

  it("no count and no extra name when nothing is filtered", () => {
    const button = /<button([^>]*data-slot="filter-sheet-trigger"[^>]*)>(.*?)<\/button>/.exec(renderToStaticMarkup(tree(0)));
    expect(button?.[1]).not.toContain("aria-label");
    expect(button?.[2]).toBe("Filters");
  });

  it("the sheet holds the same filters as labelled selects that write through the same handler", async () => {
    const onChange = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(tree(1, onChange)));
    await act(async () => document.querySelector<HTMLButtonElement>('[data-slot="filter-sheet-trigger"]')!.click());
    await act(async () => { await filterSheetLoader.load(); });
    await flush();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Filters");
    const select = [...dialog.querySelectorAll("label")].find((l) => l.textContent?.startsWith("Status"))!.querySelector("select")!;
    expect(select.value).toBe("active");
    await act(async () => { select.value = "inactive"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith("inactive");
    await act(async () => [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Show results")!.click());
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
