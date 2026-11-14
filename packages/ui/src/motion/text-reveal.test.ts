import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TextReveal } from "./text-reveal";

const css = readFileSync(path.resolve(import.meta.dirname, "../styles/base.css"), "utf8");
const pieces = (html: string) => [...html.matchAll(/<span data-piece="" style="--i:(\d+)">([^<]*)<\/span>/g)].map((m) => [Number(m[1]), m[2]]);

describe("TextReveal markup", () => {
  it("screen readers get the sentence once; the pieces are aria-hidden and numbered in order", () => {
    const html = renderToStaticMarkup(h(TextReveal, { text: "No users yet" }));
    expect(html).toBe('<p class="reveal-text"><span class="sr-only">No users yet</span><span aria-hidden="true">'
      + '<span data-piece="" style="--i:0">No</span> <span data-piece="" style="--i:1">users</span> <span data-piece="" style="--i:2">yet</span></span></p>');
  });
  it("by char: letters are grouped per word, numbered across words, and a joined emoji is one piece", () => {
    const html = renderToStaticMarkup(h(TextReveal, { text: "ab 👨‍👩‍👧", by: "char", as: "h2" }));
    expect(html.startsWith('<h2 class="reveal-text">')).toBe(true);
    expect(html.match(/data-word=""/g)).toHaveLength(2);
    expect(pieces(html)).toEqual([[0, "a"], [1, "b"], [2, "👨‍👩‍👧"]]);
  });
  it("starts unshown: the reveal runs once the text is seen on screen", () => {
    expect(renderToStaticMarkup(h(TextReveal, { text: "x" }))).not.toContain("data-shown");
  });
});

describe("reveal-text (base.css)", () => {
  const at = css.indexOf("@utility reveal-text");
  const util = css.slice(at, css.indexOf("\n}\n", at));
  it("each piece runs --reveal-dur with --reveal-ease, --reveal-step apart; no literal timing", () => {
    expect(css).toContain("@keyframes text-reveal { from { opacity: 0; filter: blur(var(--reveal-blur)); transform: translateY(0.35em); } }");
    // opacity 1 once shown: the keyframes only name `from`, so the piece must end on its own value
    expect(util).toContain("&[data-shown] [data-piece] { opacity: 1; animation: text-reveal var(--reveal-dur) var(--reveal-ease) both; animation-delay: calc(var(--i) * var(--reveal-step));");
    expect(util).not.toMatch(/\d+ms|\d*\.\d+s\b/);
  });
  it("reduced motion: fade only, mirrored by the /ds preview scope", () => {
    expect(util).toContain("@media (prefers-reduced-motion: reduce) { &[data-shown] [data-piece] { animation: fade-in var(--dur-instant) linear both; } }");
    expect(css).toContain('[data-motion-preview="reduced"] .reveal-text[data-shown] [data-piece] { animation: fade-in var(--dur-instant) linear both !important; }');
  });
});
