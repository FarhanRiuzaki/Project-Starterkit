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

  it("reveal on row hover, whenever focus is inside the row (keyboard), while their menu is open, and always on touch", () => {
    const out = table([{ id: "a" }]);
    expect(out).toMatch(/<tr data-slot="table-row" class="group\/row /);
    const wrap = /<div class="([^"]*)"><button type="button">View commands a/.exec(out)?.[1] ?? "";
    expect(wrap.split(" ")).toEqual(expect.arrayContaining(["opacity-0", "group-hover/row:opacity-100", "group-focus-within/row:opacity-100", "has-data-[state=open]:opacity-100", "pointer-coarse:opacity-100"]));
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

describe("DataTable loading shape (no layout shift)", () => {
  type S = { id: string };
  const base = { label: "Entries", rows: [] as S[], rowKey: (r: S) => r.id, columns: [{ key: "id", header: "ID", cell: (r: S) => r.id }],
    empty: { icon: SessionsIcon, title: "No entries", description: "None yet." }, loading: true };
  const skeletons = (out: string) => (out.match(/<tr[^>]*aria-hidden="true"/g) ?? []).length;
  it("server mode draws one skeleton row per page-size row and keeps a footer placeholder", () => {
    const out = renderToStaticMarkup(h(DataTable<S>, { ...base,
      paging: { mode: "server", page: 1, pageSize: 25, total: 0, pageSizes: [15, 25], onPageChange: () => {}, onPageSizeChange: () => {} } }));
    expect(skeletons(out)).toBe(25);
    expect(out).toContain('data-slot="pagination-placeholder"');
    expect(out).toMatch(/class="min-h-12 border-t border-line"/);
  });
  it("no flash: on the first render the skeleton rows hold the height hidden, and nothing is aria-busy or dimmed yet", () => {
    const out = renderToStaticMarkup(h(DataTable<S>, { ...base,
      paging: { mode: "server", page: 1, pageSize: 15, total: 0, busy: true, pageSizes: [15], onPageChange: () => {}, onPageSizeChange: () => {} } }));
    expect(out.match(/<tr[^>]*aria-hidden="true"/g)?.every((tr) => tr.includes("invisible"))).toBe(true);
    expect(out).not.toContain("aria-busy");
    expect(out).not.toContain("opacity-60");
  });
  it("skeletonRows sets the count elsewhere (default 8)", () => {
    expect(skeletons(renderToStaticMarkup(h(DataTable<S>, base)))).toBe(8);
    expect(skeletons(renderToStaticMarkup(h(DataTable<S>, { ...base, skeletonRows: 5 })))).toBe(5);
  });
});

/**
 * Stacked rows below 768 px (responsive spec "DataTable"): one DOM for every width. Each cell carries its column's
 * phone role (`data-mobile`); CSS turns the row into a card (title, meta label–value pairs, the leading checkbox and
 * the row actions) and hides `hidden` cells. The table keeps its semantics (explicit roles survive the display change).
 */
describe("DataTable stacked rows (phone)", () => {
  type S = { id: string; name: string; city: string; note: string };
  const cols = (over: Partial<Record<"pick" | "name" | "city" | "note", "title" | "meta" | "hidden" | "lead" | undefined>> = {}) => [
    { key: "pick", header: "Select", mobile: over.pick ?? ("lead" as const), cell: (r: S) => h("input", { type: "checkbox", "aria-label": `Select ${r.name}` }) },
    { key: "name", header: "Name", mobile: over.name ?? ("title" as const), cell: (r: S) => r.name },
    { key: "city", header: "City", mobile: over.city ?? ("meta" as const), cell: (r: S) => r.city },
    { key: "note", header: "Note", mobile: over.note ?? ("hidden" as const), cell: (r: S) => r.note },
  ];
  const render = (columns = cols(), extra: Record<string, unknown> = {}) => renderToStaticMarkup(h(DataTable<S>, {
    label: "People", rows: [{ id: "a", name: "Alex", city: "Oslo", note: "n1" }], rowKey: (r) => r.id, columns,
    empty: { icon: SessionsIcon, title: "No people", description: "None yet." },
    rowActions: (r) => h("button", { type: "button" }, `Actions for ${r.name}`), ...extra,
  }));
  const cell = (out: string, text: string) => new RegExp(`<td([^>]*)>(?:(?!</td>).)*${text}`).exec(out)?.[1] ?? "";

  it("each cell carries its phone role; the row is a card grid below md, the header row is hidden there", () => {
    const out = render();
    expect(cell(out, "Select Alex")).toContain('data-mobile="lead"');
    expect(cell(out, "Alex<")).toContain('data-mobile="title"');
    expect(cell(out, "Oslo")).toContain('data-mobile="meta"');
    expect(cell(out, "n1")).toContain('data-mobile="hidden"');
    expect(cell(out, "n1")).toMatch(/max-md:hidden/);
    expect(cell(out, "Actions for Alex")).toContain('data-mobile="actions"');
    expect(out).toMatch(/<tr(?=[^>]*role="row")[^>]*class="[^"]*max-md:grid/);
    expect(out).toMatch(/<thead(?=[^>]*role="rowgroup")[^>]*class="[^"]*max-md:hidden/);
    expect(out).toMatch(/<table(?=[^>]*role="table")[^>]*class="[^"]*max-md:block/);
  });

  it("a meta cell shows its column header as the label on a phone only", () => {
    const out = render();
    expect(out).toMatch(/<td[^>]*data-mobile="meta"[^>]*><span class="[^"]*md:hidden[^"]*">City<\/span>Oslo<\/td>/);
    expect(out).not.toMatch(/<td[^>]*data-mobile="title"[^>]*><span class="[^"]*md:hidden[^"]*">Name</);
  });

  it("without a declared title the first column without a role is the title", () => {
    const out = render(cols({ name: undefined, city: undefined }));
    expect(cell(out, "Alex<")).toContain('data-mobile="title"');
    expect(cell(out, "Oslo")).toContain('data-mobile="meta"');
  });

  it("dev check: exactly one title (two, or none, throws)", () => {
    expect(() => render(cols({ city: "title" }))).toThrow(/exactly one column/);
    expect(() => render(cols({ name: "meta" }))).toThrow(/exactly one column/);
  });

  it("row actions are always visible on a phone card; the selected mark moves to the card", () => {
    const out = render(undefined, { isSelected: () => true });
    expect(/<div class="([^"]*)"><button type="button">Actions for Alex/.exec(out)?.[1]?.split(" ")).toContain("max-md:opacity-100");
    expect(out).toMatch(/<tr(?=[^>]*role="row")[^>]*class="[^"]*max-md:data-\[state=selected\]:row-mark/);
  });

  it("the loading shape is the same card: skeleton cells carry the column roles", () => {
    const out = renderToStaticMarkup(h(DataTable<S>, { label: "People", rows: [], rowKey: (r) => r.id, columns: cols(), loading: true, skeletonRows: 2,
      empty: { icon: SessionsIcon, title: "No people", description: "None yet." } }));
    expect((out.match(/<td[^>]*data-mobile="title"/g) ?? []).length).toBe(2);
    expect((out.match(/<td(?=[^>]*data-mobile="hidden")[^>]*class="[^"]*max-md:hidden/g) ?? []).length).toBe(2);
  });
});

describe("DataTable sort by select (phone)", () => {
  type S = { id: string };
  const columns = [
    { key: "name", header: "Name", sortable: true, cell: (r: S) => r.id },
    { key: "city", header: "City", cell: (r: S) => r.id },
    { key: "at", header: "Created", sortable: true, cell: (r: S) => r.id },
  ];
  const base = { label: "People", rows: [{ id: "a" }], rowKey: (r: S) => r.id, columns, empty: { icon: SessionsIcon, title: "No people", description: "None yet." } };

  it("lists the sortable columns in both directions, shows the current sort, and is hidden from md", () => {
    const out = renderToStaticMarkup(h(DataTable<S>, { ...base, sort: { key: "at", dir: "desc" }, onSortChange: () => {} }));
    const bar = /<div class="([^"]*)"><label for="[^"]+"[^>]*>Sort by<\/label>/.exec(out)?.[1] ?? "";
    expect(bar.split(" ")).toContain("md:hidden");
    const options = [...out.matchAll(/<option value="([^"]+)"( selected="")?>([^<]+)<\/option>/g)].map((m) => [m[1], m[3], !!m[2]]);
    expect(options).toEqual([
      ["name:asc", "Name, ascending", false], ["name:desc", "Name, descending", false],
      ["at:asc", "Created, ascending", false], ["at:desc", "Created, descending", true],
    ]);
  });

  it("a sort the select doesn't list (a key without a sortable column) shows the placeholder, not a wrong option", () => {
    const out = renderToStaticMarkup(h(DataTable<S>, { ...base, sort: { key: "city", dir: "asc" }, onSortChange: () => {} }));
    expect(out).toMatch(/<option value="" disabled="" selected="">Choose a column<\/option>/);
    expect(out).not.toMatch(/<option value="[^"]+" selected="">/);
  });

  it("no select without sortable columns or without onSortChange", () => {
    expect(renderToStaticMarkup(h(DataTable<S>, { ...base, sort: { key: "at", dir: "desc" } }))).not.toContain("Sort by");
  });
});
