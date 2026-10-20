import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsersIcon } from "../ui/icons";
import { Panel } from "./panel";
import { Avatar } from "./avatar";
import { TickMeter } from "./meter";
import { StatTile } from "./stat-tile";
import { PasswordChecks } from "./password-checks";

/** Server markup of the v3 signature components (spec §5.4, §5.5): structure and copy, not pixels. */
const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el);

describe("Panel (tray + card)", () => {
  it("tray holds the header (title-2, count, caption) and one card with the content", () => {
    const out = html(h(Panel, { title: "Sessions", count: 312, description: "Newest first", icon: UsersIcon, children: h("p", null, "body") }));
    expect(out).toMatch(/^<section class="[^"]*rounded-xl[^"]*bg-tray[^"]*p-tray/);
    expect(out).toContain('<h2 class="text-title-2 text-fg">Sessions</h2>');
    expect(out).toMatch(/data-slot="count-badge"[^>]*>312</);
    expect(out).toContain("Newest first");
    expect(out).toMatch(/<div class="[^"]*rounded-lg border border-line bg-card shadow-card p-4[^"]*"><p>body<\/p><\/div>/);
  });
  it("flush: the card has no padding (a table is the card); footnote sits under the card", () => {
    const out = html(h(Panel, { title: "Table", flush: true, footnote: "Data from 14:02 WIB · Metrics", children: h("table") }));
    expect(out).toMatch(/bg-card shadow-card overflow-clip"><table><\/table><\/div><div class="[^"]*text-caption text-fg-3">Data from 14:02 WIB · Metrics<\/div>/);
  });
  it("description: after a middot on the title row; on a phone its own line, no middot", () => {
    const out = html(h(Panel, { title: "Users", description: "Select rows", children: "x" }));
    expect(out).toMatch(/<p class="min-w-0 grow basis-48 text-body-sm text-fg-3 max-md:order-last max-md:basis-full"><span aria-hidden="true" class="mr-2 text-fg-4 max-md:hidden">·<\/span>Select rows<\/p>/);
  });
  it("flat: card only, no tray; cards: no inner card wrapper", () => {
    expect(html(h(Panel, { variant: "flat", children: "x" }))).not.toContain("bg-tray");
    const cards = html(h(Panel, { title: "KPIs", cards: true, children: h("i") }));
    expect(cards).not.toContain("bg-card");
  });
});

describe("StatTile (KPI)", () => {
  it("number-first delta → pill (arrow + number) right of the label, comparison as caption", () => {
    const out = html(h(StatTile, { label: "AI requests · 24 hours", value: "1,284", delta: { text: "+18% vs previous 24 hours", direction: "up", good: "up" } }));
    expect(out).toMatch(/<span class="-my-0.5 ml-auto [^"]*bg-healthy-soft text-healthy-ink"><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>\+18%<\/span>/);
    expect(out).toContain('<span class="text-caption text-fg-3">vs previous 24 hours</span>');
    expect(out).toContain(">1,284<");
  });
  it("bad direction tints Down; text that is not number-first stays a caption without a pill", () => {
    expect(html(h(StatTile, { label: "Cost", value: "4.2", delta: { text: "+8.2% vs previous 7 days", direction: "up", good: "down" } }))).toContain("bg-down-soft text-down-ink");
    const flat = html(h(StatTile, { label: "Developers connected", value: "4", delta: { text: "19 of 24 services running", direction: "flat", good: null } }));
    expect(flat).not.toContain("rounded-full px-1.5");
    expect(flat).toContain('<span class="text-caption text-fg-3">19 of 24 services running</span>');
  });
  it("unit in fg-3; tween keeps the final value for screen readers", () => {
    const out = html(h(StatTile, { label: "Tokens", value: "4.6", unit: "M", tween: { value: 4.6, format: (v: number) => v.toFixed(1) } }));
    expect(out).toMatch(/<span class="ml-0\.5 text-body font-normal tracking-normal text-fg-3">M<\/span>/);
    expect(out).toContain('<span class="sr-only">4.6</span>');
  });
  it("caption without a delta: caption line, no pill", () => {
    const out = html(h(StatTile, { label: "Tokens", value: "1,204", caption: "1,204 tokens today" }));
    expect(out).toContain('<span class="text-caption text-fg-3">1,204 tokens today</span>');
    expect(out).not.toContain("rounded-full px-1.5");
  });
  it("caption overrides the comparison under the value; the pill stays", () => {
    const out = html(h(StatTile, { label: "AI requests", value: "12", caption: "Last 7 days · vs previous 7 days", delta: { text: "+15% vs previous 7 days", direction: "up", good: null } }));
    expect(out).toContain(">Last 7 days · vs previous 7 days</span>");
    expect(out).toMatch(/bg-tray text-fg-2"><svg[^>]*>.*?<\/svg>\+15%<\/span>/);
  });
});

describe("PasswordChecks", () => {
  it("a met item is fg with a tick, an open one fg-3 with a ring; each says its state to a screen reader; no live region", () => {
    const out = html(h(PasswordChecks, { id: "pw-checks", checks: [{ label: "At least 12 characters", met: true }, { label: "The two passwords match", met: false }] }));
    expect(out).toMatch(/^<ul id="pw-checks"/);
    expect(out).toMatch(/<li class="[^"]*text-fg"><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>At least 12 characters<span class="sr-only">, done<\/span><\/li>/);
    expect(out).toMatch(/<li class="[^"]*text-fg-3"><span aria-hidden="true"[^>]*rounded-full[^>]*><\/span>The two passwords match<span class="sr-only">, not yet<\/span><\/li>/);
    expect(out).not.toMatch(/aria-live|role="status"|role="alert"/);
  });
});

describe("Avatar", () => {
  it("seed picks the tint, the name gives the initials: one developer looks the same on every page", () => {
    const a = html(h(Avatar, { name: "Rina Wulandari", seed: "20990001" }));
    const b = html(h(Avatar, { name: "Rina", seed: "20990001" }));
    const tint = (s: string) => /bg-chart-\d\/15/.exec(s)?.[0];
    expect(tint(a)).toBe(tint(b));
    expect(a).toContain(">RW</span>");
    expect(b).toContain(">R</span>");
  });
  it("without a seed the name seeds the tint (v2 behaviour)", () => {
    const tint = (s: string) => /bg-chart-\d\/15/.exec(s)?.[0];
    expect(tint(html(h(Avatar, { name: "Dimas" })))).toBe(tint(html(h(Avatar, { name: "Other", seed: "Dimas" }))));
  });
});

describe("TickMeter compact (table cell)", () => {
  it("24 ticks of 2 × 10 px, threshold 12 px, value text above; the label stays the meter's name only", () => {
    const out = html(h(TickMeter, { label: "Home", ratio: 0.5, value: "10 GB / 20 GB", threshold: 0.8, size: "compact" }));
    expect(out.match(/w-0\.5/g)).toHaveLength(24);
    expect(out.match(/h-2\.5 /g)).toHaveLength(23);
    expect(out).toMatch(/h-3 bg-fg-2/);
    expect(out).toContain('aria-label="Home"');
    expect(out).toContain('aria-valuetext="10 GB / 20 GB"');
    expect(out).not.toContain(">Home<");
    expect(out).toContain(">10 GB / 20 GB</span>");
  });
});
