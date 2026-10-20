// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionsIcon } from "../ui/icons";
import { DataTable } from "./data-table";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type S = { id: string };
let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
async function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(h(DataTable<S>, {
    label: "People", rows: [{ id: "a" }], rowKey: (r: S) => r.id,
    columns: [{ key: "name", header: "Name", sortable: true, cell: (r: S) => r.id }, { key: "at", header: "Created", sortable: true, cell: (r: S) => r.id }],
    empty: { icon: SessionsIcon, title: "No people", description: "None yet." }, ...props,
  })));
}
const change = (el: HTMLSelectElement, value: string) => act(async () => {
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
});

describe("DataTable on a phone: the sort select and the compact pagination are requests, as the headers and numbers are", () => {
  it("picking a sort calls onSortChange with the key and direction", async () => {
    const onSortChange = vi.fn();
    await mount({ sort: { key: "name", dir: "asc" }, onSortChange });
    await change(document.querySelector<HTMLSelectElement>('select[id]:not([aria-label="Rows per page"])')!, "at:desc");
    expect(onSortChange).toHaveBeenCalledWith({ key: "at", dir: "desc" });
  });

  it("compact pagination: Previous / 'Page x of y' / Next ask for the page next to it, the size select stays", async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    await mount({ paging: { mode: "server", page: 2, pageSize: 15, total: 40, pageSizes: [15, 25], maxPage: 1000, onPageChange, onPageSizeChange } });
    const nav = document.querySelector('nav[aria-label="People pages"]')!;
    const compact = [...nav.querySelectorAll("span")].find((s) => s.textContent === "Page 2 of 3")!;
    expect(compact.className.split(" ")).toContain("md:hidden");
    // The full pager's extra controls are desktop and tablet only.
    for (const l of ["First page", "Last page", "Page 1", "Page 3"]) expect(nav.querySelector(`[aria-label="${l}"]`)!.className.split(" ")).toContain("max-md:hidden");
    for (const l of ["Previous page", "Next page"]) expect(nav.querySelector(`[aria-label="${l}"]`)!.className.split(" ")).not.toContain("max-md:hidden");
    await act(async () => nav.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click());
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await act(async () => nav.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!.click());
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await change(nav.querySelector<HTMLSelectElement>('[aria-label="Rows per page"]')!, "25");
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
