import { describe, expect, it } from "vitest";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { ACTIONS, applyEdit, closeViews, viewLocked, cellState, columnCells, diff, type Draft, rebase, rowCells, toggleAll, toggleCell, toggleColumn, toggleRow, withDraft } from "./matrix";

const set = (...p: PermissionName[]) => new Set<PermissionName>(p);
const sorted = (s: ReadonlySet<PermissionName>) => [...s].sort();

describe("permission matrix", () => {
  it("columns are every action in MODULES order; cells skip combinations the catalog lacks", () => {
    expect(ACTIONS).toEqual(["view", "create", "edit", "delete"]);
    expect(rowCells("audit")).toEqual(["audit.view"]);
    expect(columnCells("create")).toEqual(["user.create", "role.create", "permission.create"]);
    expect(columnCells("delete")).not.toContain("permission.delete");
  });

  it("toggleCell adds a missing permission and removes a present one, without touching the input", () => {
    const before = set("user.view");
    expect(sorted(toggleCell(before, "user.edit"))).toEqual(["user.edit", "user.view"]);
    expect(sorted(toggleCell(before, "user.view"))).toEqual([]);
    expect(sorted(before)).toEqual(["user.view"]);
  });

  it("a half-checked row becomes full; a full row becomes empty; other rows stay", () => {
    const half = set("user.view", "user.edit", "audit.view");
    const full = toggleRow(half, "user");
    expect(sorted(full)).toEqual(["audit.view", "user.create", "user.delete", "user.edit", "user.view"]);
    expect(sorted(toggleRow(full, "user"))).toEqual(["audit.view"]);
  });

  it("the create column never touches audit (no audit.create) and clears when all its cells are on", () => {
    const on = toggleColumn(set("audit.view"), "create");
    expect(sorted(on)).toEqual(["audit.view", "permission.create", "role.create", "user.create"]);
    expect(on.has("audit.create" as PermissionName)).toBe(false);
    expect(sorted(toggleColumn(on, "create"))).toEqual(["audit.view"]);
  });

  it("toggleAll fills a partial set with the whole catalog and clears a full one", () => {
    const all = toggleAll(set("user.view"));
    expect(sorted(all)).toEqual([...PERMISSIONS].sort());
    expect(toggleAll(all).size).toBe(0);
    expect(toggleAll(set()).size).toBe(PERMISSIONS.length);
  });

  it("cellState is true, false or mixed for a group of cells", () => {
    const s = set("user.view", "user.edit");
    expect(cellState(s, rowCells("user"))).toBe("mixed");
    expect(cellState(s, rowCells("role"))).toBe(false);
    expect(cellState(toggleRow(s, "user"), rowCells("user"))).toBe(true);
    expect(cellState(s, [])).toBe(false);
  });

  it("diff lists added and removed permissions in catalog order", () => {
    expect(diff(set("user.view", "role.view"), set("role.edit", "user.view", "audit.view"))).toEqual({ added: ["role.edit", "audit.view"], removed: ["role.view"] });
  });
  it("with `allowed`, header toggles touch only cells the actor may change", () => {
    const allowed = set("user.view", "user.edit", "role.view");
    const s = set("user.delete");
    // row: allowed user cells all off -> on; user.delete (not allowed) stays as it was
    expect(sorted(toggleRow(s, "user", allowed))).toEqual(["user.delete", "user.edit", "user.view"]);
    // all allowed user cells on but user.create off: the header is mixed, so the click fills (nothing left to fill)
    expect(sorted(toggleRow(set("user.view", "user.edit", "user.delete"), "user", allowed))).toEqual(["user.delete", "user.edit", "user.view"]);
    expect(sorted(toggleColumn(set(), "view", allowed))).toEqual(["role.view", "user.view"]);
    expect(sorted(toggleAll(set("audit.view"), allowed))).toEqual(["audit.view", "role.view", "user.edit", "user.view"]);
    // nothing allowed in the group: unchanged
    expect(sorted(toggleRow(s, "audit", allowed))).toEqual(["user.delete"]);
  });
  it("draft edits compose: three toggles queued in one tick all apply (functional updates, no stale closure)", () => {
    const saved = set("user.view", "audit.view");
    // what React does with setDraft(prev => applyEdit(saved, prev, f)) called three times before a render
    const queue = [(v: ReadonlySet<PermissionName>) => toggleCell(v, "role.view"), (v: ReadonlySet<PermissionName>) => toggleCell(v, "role.edit"),
      (v: ReadonlySet<PermissionName>) => toggleCell(v, "audit.view")];
    const draft = queue.reduce<Draft | null>((d, f) => applyEdit(saved, d, f), null);
    expect(draft).toEqual({ added: ["role.view", "role.edit"], removed: ["audit.view"] });
    expect(sorted(withDraft(saved, draft))).toEqual(["role.edit", "role.view", "user.view"]);
    // toggling a cell back drops it from the draft
    expect(applyEdit(saved, draft, (v) => toggleCell(v, "audit.view"))).toEqual({ added: ["role.view", "role.edit"], removed: [] });
  });
  it("tri-state: a mixed header fills the cells the actor may change, even when those are all on already", () => {
    const allowed = set("user.view", "user.edit");
    // allowed cells on, user.create / user.delete (not allowed) off: the header shows mixed, so a click fills (no-op), never clears
    const s = set("user.view", "user.edit");
    expect(cellState(s, rowCells("user"))).toBe("mixed");
    expect(sorted(toggleRow(s, "user", allowed))).toEqual(["user.edit", "user.view"]);
    // only a fully checked header clears (and only what the actor may change)
    expect(sorted(toggleRow(set("user.view", "user.edit", "user.create", "user.delete"), "user", allowed))).toEqual(["user.create", "user.delete"]);
  });

  it("a module's view comes with its other actions: on adds view, view off takes the module's other actions with it", () => {
    const saved = set("audit.view");
    expect(applyEdit(saved, null, (v) => toggleCell(v, "user.edit"))).toEqual({ added: ["user.view", "user.edit"], removed: [] });
    expect(applyEdit(saved, null, (v) => toggleColumn(v, "delete"))).toEqual({ added: ["user.view", "user.delete", "role.view", "role.delete"], removed: [] });
    const full = set("user.view", "user.edit", "user.delete", "audit.view");
    expect(applyEdit(full, null, (v) => toggleCell(v, "user.view"))).toEqual({ added: [], removed: ["user.view", "user.edit", "user.delete"] });
  });

  it("with `allowed`, closeViews never adds a view the actor lacks nor strips an action they lack", () => {
    const allowed = set("user.edit", "audit.view");
    // user.edit on, user.view not held: view is not added
    expect(sorted(closeViews(set(), set("user.edit"), allowed))).toEqual(["user.edit"]);
    // without `allowed` it still adds it
    expect(sorted(closeViews(set(), set("user.edit")))).toEqual(["user.edit", "user.view"]);
    // applyEdit threads `allowed` through
    expect(applyEdit(set(), null, (v) => toggleCell(v, "user.edit"), allowed)).toEqual({ added: ["user.edit"], removed: [] });
    // view off (held) removes only the other actions the actor holds; user.delete stays
    const held = set("user.view", "user.edit");
    // user.delete stays on (not held), so the view stays too: the server's withViews would re-add it anyway
    expect(sorted(closeViews(set("user.view", "user.edit", "user.delete"), set("user.edit", "user.delete"), held))).toEqual(["user.delete", "user.view"]);
    expect(sorted(closeViews(set("user.view", "user.edit"), set("user.edit"), held))).toEqual([]);
    // the view cell is locked while an action the actor lacks is on
    expect(viewLocked(set("user.view", "user.delete"), "user", held)).toBe(true);
    expect(viewLocked(set("user.view", "user.edit"), "user", held)).toBe(false);
    expect(viewLocked(set("user.view", "user.delete"), "user")).toBe(false);
  });

  it("rebase: a draft made against an older set shows and sends only what still changes something", () => {
    const draft: Draft = { added: ["role.view", "role.edit"], removed: ["audit.view"] };
    // meanwhile someone else added role.view and removed audit.view
    expect(rebase(set("user.view", "role.view"), draft)).toEqual({ added: ["role.edit"], removed: [] });
    expect(rebase(set("user.view"), null)).toEqual({ added: [], removed: [] });
  });
});
