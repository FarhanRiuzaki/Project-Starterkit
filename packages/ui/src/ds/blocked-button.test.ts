import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { BlockedButton } from "./blocked-button";

const REASON = "This is the last active Superadmin. Make another user Superadmin first.";
const html = (props: Partial<Parameters<typeof BlockedButton>[0]> = {}) =>
  renderToStaticMarkup(h(TooltipProvider, null, h(BlockedButton, { reason: REASON, ...props }, "Deactivate user")));
const classesOf = (out: string, re: RegExp) => re.exec(out)?.[1]?.split(" ") ?? [];

/** The reason is a hover tooltip; on touch it is a visible caption under the button (spec "Target sentuh"), CSS only. */
describe("BlockedButton reason on touch", () => {
  it("the reason stays the button's description, and under a coarse pointer it is a visible caption below it", () => {
    const out = html();
    const id = /aria-describedby="([^"]+)"/.exec(out)?.[1];
    expect(id).toBeTruthy();
    const caption = classesOf(out, new RegExp(`<span id="${id}" class="([^"]*)">${REASON.replace(".", "\\.")}`));
    expect(caption).toEqual(expect.arrayContaining(["sr-only", "pointer-coarse:not-sr-only", "text-caption", "text-fg-3"]));
    expect(out.indexOf("</button>"), "caption after the button").toBeLessThan(out.indexOf(`id="${id}"`));
  });

  it("the wrapper adds no box with a fine pointer (desktop layout unchanged) and stacks button (its own width) and caption under a coarse one", () => {
    const wrap = classesOf(html(), /^<span class="([^"]*)"><button/);
    expect(wrap).toEqual(expect.arrayContaining(["contents", "pointer-coarse:inline-flex", "flex-col", "items-start"]));
  });

  it("caption={false} (dense rows with the reason elsewhere) keeps the description screen-reader only", () => {
    const out = html({ caption: false });
    expect(out).toMatch(/aria-describedby=/);
    expect(out).not.toContain("pointer-coarse:not-sr-only");
  });

  it("no reason: a plain button, no wrapper", () => {
    expect(html({ reason: null })).toMatch(/^<button/);
  });
});

/** A blocked button keeps the caller's classes (it used to drop them), and the touch wrapper takes the pair's layout. */
describe("BlockedButton layout classes", () => {
  it("the caller's className stays on the blocked button, after the blocked look", () => {
    const btn = classesOf(html({ className: "h-10 w-full" }), /<button[^>]*class="([^"]*)"/);
    expect(btn).toEqual(expect.arrayContaining(["h-10", "w-full", "aria-disabled:opacity-50"]));
  });

  it("wrapClassName lays out the button + caption pair under a coarse pointer (with a fine one the wrapper has no box)", () => {
    const wrap = classesOf(html({ wrapClassName: "ml-auto items-end" }), /^<span class="([^"]*)"><button/);
    expect(wrap).toEqual(expect.arrayContaining(["contents", "pointer-coarse:inline-flex", "ml-auto", "items-end"]));
    expect(wrap).not.toContain("items-start");
  });
});
