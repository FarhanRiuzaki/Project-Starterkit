import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { BreakdownCard } from "./breakdown-card";
import { BreakdownCard as fromBarrel } from "./index";

const parts = [
  { id: "viewer", label: "Viewer", value: 212 },
  { id: "admin", label: "Admin", value: 1024 },
  { id: "owner", label: "Owner", value: 48 },
];
const empty = { title: "No users yet", description: "Users appear here after the first invitation is accepted." };
const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(h(TooltipProvider, null,
  h(BreakdownCard, { title: "Users by role", parts, otherLabel: "Other roles", empty, ...props })));
const rows = (html: string) => [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, "|").split("|").filter(Boolean));
const bar = (html: string) => /<div aria-hidden="true" class="chart-hbar[^"]*">(.*?)<\/div>/.exec(html)?.[1] ?? "";

describe("BreakdownCard: data", () => {
  const html = render({ unit: "users" });
  it("is exported from the charts barrel", () => {
    expect(fromBarrel).toBe(BreakdownCard);
  });
  it("names itself: the title is the card's heading and the list's accessible name", () => {
    expect(html).toContain('data-slot="breakdown-card"');
    expect(html).toMatch(/<h2[^>]*>Users by role<\/h2>/);
    expect(html).toMatch(/<ul[^>]*aria-label="Users by role"/);
  });
  it("shows the total through format.ts, as a tween (animated text hidden from screen readers, final value read)", () => {
    expect(html).toContain('<span aria-hidden="true">1,284</span><span class="sr-only">1,284</span>');
    expect(html).toContain(">users</span>");
  });
  it("lists the parts largest first: label, value and share as text in every row", () => {
    expect(rows(html)).toEqual([["Admin", "1,024", "80%"], ["Viewer", "212", "16%"], ["Owner", "48", "4%"]]);
  });
  it("draws one striped bar segment per row in the row order, sized by share, decorative only", () => {
    const segs = [...bar(html).matchAll(/<span class="chart-stripes[^"]*" style="flex-grow:([\d.]+);flex-basis:0;background-color:(var\(--[a-z0-9-]+\))"><\/span>/g)];
    expect(segs.map((m) => m[2])).toEqual(["var(--chart-2)", "var(--chart-1)", "var(--chart-3)"]);
    expect(Number(segs[0]![1])).toBeCloseTo(1024 / 1284);
  });
  it("colours come from the six chart slots, and the same colour marks a part's row and its segment", () => {
    const colours = [...html.matchAll(/background-color:([^;"]+)/g)].map((m) => m[1]!);
    expect(colours).toHaveLength(6);
    expect(colours.every((c) => /^var\(--chart-[1-6]\)$/.test(c))).toBe(true);
    expect(colours.slice(0, 3)).toEqual(colours.slice(3));
  });
  it("a fixed slot keeps a part's colour whatever its rank", () => {
    const out = render({ parts: [{ label: "A", value: 1, slot: 4 }, { label: "B", value: 9, slot: 0 }] });
    expect([...bar(out).matchAll(/background-color:([^;"]+)/g)].map((m) => m[1])).toEqual(["var(--chart-1)", "var(--chart-5)"]);
  });
  it("folds the parts past max into one last row with the caller's label and the neutral colour", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ label: `Team ${i + 1}`, value: 70 - i * 10 }));
    const out = render({ parts: many, max: 3 });
    expect(rows(out)).toEqual([["Team 1", "70", "25%"], ["Team 2", "60", "21%"], ["Other roles", "150", "54%"]]);
    expect(bar(out)).toContain("background-color:var(--fg-3)");
  });
  it("the caller's format is used for the total and every value", () => {
    const out = render({ format: (v: number) => `${v} ms` });
    expect(out).toContain('<span class="sr-only">1284 ms</span>');
    expect(rows(out)[0]).toEqual(["Admin", "1024 ms", "80%"]);
  });
  it("one part: one row at 100% and one full segment", () => {
    const out = render({ parts: [{ label: "Password", value: 5 }] });
    expect(rows(out)).toEqual([["Password", "5", "100%"]]);
    expect(bar(out).match(/<span/g)).toHaveLength(1);
  });
  it("a long label stays whole in the markup and is cut by CSS on one line, with the value and share kept", () => {
    const long = "Single sign-on through the identity provider of the head office";
    const out = render({ parts: [{ label: long, value: 3 }, { label: "Password", value: 1 }] });
    expect(out).toMatch(new RegExp(`<span class="block min-w-0 truncate"[^>]*>${long}</span>`));
    expect(rows(out)[0]).toEqual([long, "3", "75%"]);
  });
  it("zero and negative parts are left out; with none left the card is empty", () => {
    expect(rows(render({ parts: [{ label: "A", value: 0 }, { label: "B", value: -3 }, { label: "C", value: 2 }] }))).toEqual([["C", "2", "100%"]]);
    const none = render({ parts: [{ label: "A", value: 0 }, { label: "B", value: -3 }] });
    expect(none).toContain("No users yet");
    expect(none).not.toContain("<li");
  });
  it("no status colour and no literal colour anywhere", () => {
    expect(html).not.toMatch(/healthy|degraded|bg-down|#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
  });
});

describe("BreakdownCard: the other four states", () => {
  it("loading: the content's shape (total, bar, max rows) as hidden-from-readers skeletons, title kept, no rows", () => {
    const out = render({ state: "loading", max: 3 });
    expect(out).toMatch(/<h2[^>]*>Users by role<\/h2>/);
    expect(out).toMatch(/<div aria-hidden="true" data-reveal="skeleton"/);
    expect(out.match(/data-slot="skeleton"/g)).toHaveLength(2 + 3 * 3);
    expect(out).not.toContain("<li");
    expect(out).not.toContain("1,284");
  });
  it("empty: the caller's copy, no total and no bar", () => {
    const out = render({ parts: [] });
    expect(out).toContain('data-slot="empty-state"');
    expect(out).toContain("No users yet");
    expect(out).toContain("Users appear here after the first invitation is accepted.");
    expect(out).not.toContain("chart-hbar");
    expect(render({ parts: [], state: "empty" })).toBe(out);
  });
  it("error: an alert with the cause and a retry button, no stale rows", () => {
    const out = render({ state: "error", error: "The users service did not answer.", onRetry: () => undefined });
    expect(out).toMatch(/role="alert"/);
    expect(out).toContain("The users service did not answer.");
    expect(out).toMatch(/<button[^>]*>.*Try again<\/button>/);
    expect(out).not.toContain("<li");
    expect(render({ state: "error" })).not.toContain("<button");
  });
  it("stale: a status notice over the kept total, bar and rows", () => {
    const out = render({ state: "stale", error: "Showing data from 14:02. Try refreshing." });
    expect(out).toMatch(/role="status"[^>]*>.*Showing data from 14:02\. Try refreshing\./);
    expect(rows(out)).toHaveLength(3);
    expect(out).toContain('<span class="sr-only">1,284</span>');
    expect(out.indexOf('role="status"')).toBeLessThan(out.indexOf("<ul"));
  });
  it("stale or data without any part falls back to empty, an error stays an error", () => {
    expect(render({ parts: [], state: "stale" })).toContain("No users yet");
    expect(render({ parts: [], state: "error" })).toMatch(/role="alert"/);
  });
});
