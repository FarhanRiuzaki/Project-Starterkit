import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Tooltip, TooltipProvider, TooltipTrigger } from "./tooltip";

type Variant = NonNullable<Parameters<typeof Button>[0]["variant"]>;
const markup = (variant?: Variant) => renderToStaticMarkup(h(Button, { variant }, "Save"));
const classes = (out: string) => /class="([^"]*)"/.exec(out)![1]!.split(" ");

/** The affectUI look (design-system.md §3.7): what the class string carries; the gradient itself is base.css. */
describe("Button variants", () => {
  it("default: --action under the gradient, a transparent border for the lit edge, disabled at 0.4", () => {
    const out = markup();
    expect(out).toContain('data-slot="button"');
    expect(out).toContain('data-variant="default"');
    expect(classes(out)).toEqual(expect.arrayContaining(["bg-action", "border-transparent", "disabled:opacity-40"]));
    expect(classes(out)).not.toContain("disabled:opacity-50");
  });
  it("under an asChild trigger the slot name is the trigger's, the class and variant stay (what base.css keys on)", () => {
    const out = renderToStaticMarkup(h(TooltipProvider, null, h(Tooltip, null, h(TooltipTrigger, { asChild: true }, h(Button, null, "Save")))));
    expect(out).toContain('data-slot="tooltip-trigger"');
    expect(out).toContain('data-variant="default"');
    expect(classes(out)).toContain("bg-action");
  });
  it.each(["secondary", "outline"] as const)("%s: card fill, --line edge, shadow-xs", (variant) => {
    const c = classes(markup(variant));
    expect(c).toEqual(expect.arrayContaining(["border-line", "bg-card", "shadow-xs"]));
    expect(c).not.toContain("border-line-strong");
  });
  it("destructive: a soft Down fill with Down ink and no border or shadow", () => {
    const c = classes(markup("destructive"));
    expect(c).toEqual(expect.arrayContaining(["border-transparent", "bg-down-soft", "text-down-ink", "hover:bg-down-soft-hover"]));
    for (const gone of ["shadow-xs", "bg-card", "border-down-mark/40"]) expect(c).not.toContain(gone);
  });
});
