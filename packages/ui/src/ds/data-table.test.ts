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
