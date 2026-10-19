import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import * as Menu from "./dropdown-menu";
import * as MenuImpl from "./dropdown-menu-impl";
import * as Pop from "./popover";
import * as PopImpl from "./popover-impl";

/** Attributes of every element, in document order; generated ids (and the ids they point to) left out. */
function shape(html: string, keep = false) {
  return [...html.matchAll(/<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>/g)].map(([, tag, attrs]) => {
    const pairs = [...(attrs ?? "").matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].map(([, k, v]) => [k!, v ?? ""] as const)
      .filter(([k]) => keep || (k !== "id" && k !== "aria-controls"));
    return { tag, attrs: Object.fromEntries(pairs) };
  });
}
const html = (el: ReactElement) => renderToStaticMarkup(el);
/** Attributes the Radix trigger has and the stand-in lacks: exactly the generated ones the comparison leaves out. */
const extra = (real: string, twin: string) => {
  const t = new Set(Object.keys(shape(twin, true)[0]!.attrs));
  return Object.keys(shape(real, true)[0]!.attrs).filter((k) => !t.has(k)).sort();
};

describe("deferred overlay stand-in (server and hydration markup)", () => {
  it("menu: the stand-in trigger has the closed Radix trigger's markup; the content renders nothing, as when closed", () => {
    const tree = (M: typeof Menu | typeof MenuImpl) => h(M.DropdownMenu, null,
      h(M.DropdownMenuTrigger, { asChild: true }, h(Button, { variant: "secondary", size: "sm", "aria-label": "Auto-refresh: every 30 s" }, "30 s")),
      h(M.DropdownMenuContent, null, h(M.DropdownMenuItem, null, "Refresh now")));
    const twin = html(tree(Menu)), real = html(tree(MenuImpl));
    expect(twin).toContain('aria-haspopup="menu"');
    expect(twin).toContain('aria-expanded="false"');
    expect(twin).not.toContain("Refresh now");
    expect(shape(twin)).toEqual(shape(real));
    expect(extra(real, twin)).toEqual(["id"]);
  });

  it("menu without asChild renders the same button as Radix", () => {
    const tree = (M: typeof Menu | typeof MenuImpl) => h(M.DropdownMenu, null, h(M.DropdownMenuTrigger, { className: "x", "aria-label": "Account" }, "A"));
    expect(shape(html(tree(Menu)))).toEqual(shape(html(tree(MenuImpl))));
  });

  it("popover: same trigger markup as the closed Radix popover (aria-haspopup dialog), no content", () => {
    const tree = (P: typeof Pop | typeof PopImpl) => h(P.Popover, null,
      h(P.PopoverTrigger, { asChild: true }, h(Button, { variant: "secondary", size: "sm" }, "Status guide")),
      h(P.PopoverContent, null, h("h2", null, "What these statuses mean")));
    const twin = html(tree(Pop)), real = html(tree(PopImpl));
    expect(twin).toContain('aria-haspopup="dialog"');
    expect(twin).not.toContain("What these statuses mean");
    expect(shape(twin)).toEqual(shape(real));
    expect(extra(real, twin)).toEqual([]);
  });

  it("a part follows its own root, not the loader: loaded chunk + root still on the stand-in → the part renders nothing", async () => {
    await Menu.menuLoader.load();
    // Outside a root (the closest case to a root that has not switched yet): Radix parts would throw without Menu.
    expect(html(h(Menu.DropdownMenuContent, null, h(Menu.DropdownMenuItem, null, "Refresh now")))).toBe("");
  });
});
