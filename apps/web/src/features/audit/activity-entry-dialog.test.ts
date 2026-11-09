import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ActivityEntryDialog } from "./activity-entry-dialog";

const fixture = vi.hoisted(() => ({ entry: {
  id: "00000000-0000-4000-8000-000000000001", at: "2026-11-08T12:00:00Z",
  action: "project.update", actor: { id: "00000000-0000-4000-8000-000000000002", name: "Recorded actor" },
  target: { type: " type\t", id: " leading\nID trailing ", label: "Recorded label" }, before: null, after: null,
} }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: fixture.entry, error: null }) }));
// Isolate the real ready metadata from the modal shell; the dialog's Target row is rendered unchanged.
vi.mock("./entry-dialog", () => ({ EntryDialog: ({ rows }: { rows: [string, ReactNode][] }) => h("div", null, rows.find(([label]) => label === "Target")?.[1]) }));
const markup = () => renderToStaticMarkup(h(ActivityEntryDialog, { id: fixture.entry.id, onClose: () => {}, returnFocus: () => {}, onInvestigate: () => {} }));

it("ready Target makes recorded edge whitespace, controls and separators readable without changing its identity", () => {
  const target = { ...fixture.entry.target };
  const rendered = markup();
  expect(rendered).toContain("&quot; type\\t&quot;");
  expect(rendered).toContain("&quot; leading\\nID trailing &quot;");
  expect(fixture.entry.target).toEqual(target);
  fixture.entry.target.type = "permission";
  fixture.entry.target.id = "scope · name";
  expect(markup()).toContain("&quot;scope · name&quot;");
  fixture.entry.target.id = `<literal>\r${"X".repeat(513)}`;
  expect(markup()).toContain(`&quot;&lt;literal&gt;\\r${"X".repeat(513)}&quot;`);
});
it("ordinary recorded type and UUID retain their existing unquoted display", () => {
  fixture.entry.target.type = "project";
  fixture.entry.target.id = "00000000-0000-4000-8000-000000000003";
  const rendered = markup();
  expect(rendered).toContain(`>project ${fixture.entry.target.id}</span>`);
  expect(rendered).not.toContain("&quot;");
});
