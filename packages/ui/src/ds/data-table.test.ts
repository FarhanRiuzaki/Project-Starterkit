import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionsIcon } from "../ui/icons";
import { DataTable } from "./data-table";

type Row = { id: string };
const table = (rows: Row[]) => renderToStaticMarkup(h(DataTable<Row>, {
  label: "Sessions", rows, rowKey: (r) => r.id, columns: [{ key: "id", header: "ID", cell: (r) => r.id }],
  empty: { icon: SessionsIcon, title: "No sessions", description: "None yet." },
  rowActions: (r) => h("button", { type: "button" }, `View commands ${r.id}`),
}));

/** Row actions (UI standard §4, spec §5.7): secondary actions revealed on row hover and on keyboard focus in the row. */
describe("DataTable row actions", () => {
  it("are in every row's DOM and tab order, hidden by opacity only (never display/visibility)", () => {
    const out = table([{ id: "a" }, { id: "b" }]);
    expect(out.match(/<button type="button">View commands [ab]<\/button>/g)).toHaveLength(2);
    expect(out).not.toMatch(/<div class="[^"]*\b(hidden|invisible)\b[^"]*"><button/);
  });

  it("reveal on row hover, whenever focus is inside the row (keyboard), and while their menu is open", () => {
    const out = table([{ id: "a" }]);
    expect(out).toMatch(/<tr data-slot="table-row" class="group\/row /);
    const wrap = /<div class="([^"]*)"><button type="button">View commands a/.exec(out)?.[1] ?? "";
    expect(wrap.split(" ")).toEqual(expect.arrayContaining(["opacity-0", "group-hover/row:opacity-100", "group-focus-within/row:opacity-100", "has-data-[state=open]:opacity-100"]));
  });
});

/** R4: the highlight is opt-in and never on the first render (a page load is the baseline). */
describe("DataTable highlightNew", () => {
  const withHighlight = (rows: Row[], highlightNew?: boolean) => renderToStaticMarkup(h(DataTable<Row>, {
    label: "Sessions", rows, rowKey: (r) => r.id, columns: [{ key: "id", header: "ID", cell: (r) => r.id }],
    empty: { icon: SessionsIcon, title: "No sessions", description: "None yet." }, highlightNew,
  }));
  it("no row carries data-new without the prop, nor on the first render with it", () => {
    expect(withHighlight([{ id: "a" }, { id: "b" }])).not.toContain("data-new");
    expect(withHighlight([{ id: "a" }, { id: "b" }], true)).not.toContain("data-new");
  });
});

/** Server-driven tables (owner standard): the page's rows come from the server; sort and paging are requests. */
describe("DataTable server mode", () => {
  type S = { id: string; n: number };
  const noop = () => {};
  const server = (over: Partial<{ page: number; total: number; totalCapped: boolean; sort: { key: string; dir: "asc" | "desc" } }> = {}) => renderToStaticMarkup(h(DataTable<S>, {
    label: "Entries", rows: [{ id: "b", n: 1 }, { id: "a", n: 2 }], rowKey: (r) => r.id,
    columns: [{ key: "id", header: "ID", cell: (r) => r.id, sortable: true }, { key: "n", header: "N", cell: (r) => String(r.n) }],
    empty: { icon: SessionsIcon, title: "No entries", description: "None yet." },
    sort: over.sort ?? { key: "id", dir: "desc" }, onSortChange: noop,
    paging: { mode: "server", page: over.page ?? 2, pageSize: 15, total: over.total ?? 40, totalCapped: over.totalCapped, pageSizes: [15, 25, 50, 100], maxPage: 1000, onPageChange: noop, onPageSizeChange: noop },
  }));

  it("renders the rows in the server's order (no client sort) and marks the sorted column", () => {
    const out = server();
    expect(out.indexOf(">b<")).toBeLessThan(out.indexOf(">a<"));
    expect(out).toMatch(/<th[^>]*aria-sort="descending"[^>]*>.*?<button type="button"/);
    expect(out).not.toMatch(/<th[^>]*aria-sort[^>]*>N</);
  });

  it("footer: 'Showing a–b of n', first / previous / numbers / next / last, and a page-size select", () => {
    const out = server();
    expect(out).toContain("Showing 16–30 of 40");
    for (const l of ["First page", "Previous page", "Page 1", "Page 2", "Page 3", "Next page", "Last page"]) expect(out).toContain(`aria-label="${l}"`);
    expect(out).toMatch(/aria-label="Page 2" aria-current="page"/);
    expect(out).toMatch(/<select[^>]*aria-label="Rows per page"/);
    expect(out).toMatch(/<option value="15" selected="">15<\/option>/);
  });

  it("first and previous are disabled on page 1; the last page offered is capped at maxPage; a capped total reads n+", () => {
    const out = server({ page: 1, total: 100_000, totalCapped: true });
    expect(out).toMatch(/disabled="" aria-label="First page"/);
    expect(out).toMatch(/disabled="" aria-label="Previous page"/);
    expect(out).toContain('aria-label="Page 1000"');
    expect(out).not.toContain('aria-label="Page 6667"');
    expect(out).toContain("Showing 1–15 of 100,000+");
  });
});
