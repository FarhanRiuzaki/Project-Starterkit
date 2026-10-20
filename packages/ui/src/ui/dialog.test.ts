// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The phone variant is CSS only (`max-md:` classes, no matchMedia), so the server HTML and the first paint are already
 * the right shape at every width; the E2E (responsive.spec.ts) checks the geometry in a 390 px browser. Here: the
 * classes that make it a bottom sheet below 768 px, next to the unchanged desktop dialog.
 */
async function render(className?: string, phone?: "sheet" | "top") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(h(Dialog, { open: true },
    h(DialogContent, { className, phone },
      h(DialogHeader, null, h(DialogTitle, null, "Delete role")),
      h("div", null, "Body"),
      h(DialogFooter, null, h("button", { type: "button" }, "Delete role"))))));
  const content = document.querySelector<HTMLElement>('[data-slot="dialog-content"]')!;
  const footer = document.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!;
  const cls = (el: HTMLElement) => new Set(el.className.split(/\s+/));
  const out = { content: cls(content), footer: cls(footer) };
  await act(async () => root.unmount());
  host.remove();
  return out;
}

const SHEET = [
  "max-md:top-auto", "max-md:bottom-0", "max-md:left-0", "max-md:w-full", "max-md:max-w-none", "max-md:max-h-[90dvh]",
  "max-md:translate-x-0", "max-md:translate-y-0", "max-md:overflow-y-auto", "max-md:rounded-b-none", "max-md:pb-safe",
  "max-md:data-[state=open]:slide-in-from-bottom", "max-md:data-[state=closed]:slide-out-to-bottom",
  "max-md:data-[state=open]:zoom-in-100", "max-md:data-[state=closed]:zoom-out-100",
];

describe("Dialog below 768 px is a bottom sheet (one responsive variant in the primitive)", () => {
  it("full width at the bottom, at most 90 dvh, scrolling, safe-area padding, rises from the bottom", async () => {
    const { content } = await render();
    for (const c of SHEET) expect(content, c).toContain(c);
  });

  it("keeps the desktop dialog from 768 px: centred, 480 px, scale 0.98", async () => {
    const { content } = await render();
    for (const c of ["top-1/2", "left-1/2", "max-w-120", "-translate-x-1/2", "-translate-y-1/2", "data-[state=open]:zoom-in-98"]) expect(content, c).toContain(c);
  });

  it("a caller's desktop classes don't undo the sheet (the max-md: ones win below 768 px)", async () => {
    const { content } = await render("top-24 translate-y-0 max-h-[calc(100dvh-2rem)]");
    for (const c of SHEET) expect(content, c).toContain(c);
  });

  it("the action row sticks to the bottom of the sheet", async () => {
    const { footer } = await render();
    for (const c of ["max-md:sticky", "max-md:bottom-0", "max-md:bg-raised"]) expect(footer, c).toContain(c);
  });
});

describe("DialogContent phone=\"top\" (the command palette): below 768 px from the top edge, so the keyboard doesn't cover it", () => {
  const TOP = [
    "max-md:top-0", "max-md:left-0", "max-md:w-full", "max-md:max-w-none", "max-md:translate-x-0", "max-md:translate-y-0",
    "max-md:rounded-t-none", "max-md:border-x-0", "max-md:border-t-0", "max-md:pt-safe",
    "max-md:data-[state=open]:slide-in-from-top", "max-md:data-[state=closed]:slide-out-to-top",
    "max-md:data-[state=open]:zoom-in-100", "max-md:data-[state=closed]:zoom-out-100",
  ];
  it("full width on the top edge, slides from the top; none of the bottom-sheet classes", async () => {
    const { content } = await render("top-24 translate-y-0 p-0 md:max-w-xl", "top");
    for (const c of TOP) expect(content, c).toContain(c);
    for (const c of ["max-md:bottom-0", "max-md:top-auto", "max-md:pb-safe", "max-md:data-[state=open]:slide-in-from-bottom"]) expect(content, c).not.toContain(c);
  });
  it("keeps the desktop dialog from 768 px", async () => {
    const { content } = await render(undefined, "top");
    for (const c of ["top-1/2", "left-1/2", "max-w-120", "data-[state=open]:zoom-in-98"]) expect(content, c).toContain(c);
  });
  it("the default stays the bottom sheet", async () => {
    const { content } = await render(undefined, "sheet");
    for (const c of SHEET) expect(content, c).toContain(c);
  });
});
