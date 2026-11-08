import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { Disclosure } from "./disclosure";
import { Progress } from "./progress";
import { Timeline } from "./timeline";

const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(h(TooltipProvider, null, el));

describe("Progress", () => {
  it("determinate: a progressbar with its value, the percent shown and read, a striped primary fill", () => {
    const out = html(h(Progress, { label: "Uploading", value: 64 }));
    expect(out).toMatch(/role="progressbar" aria-label="Uploading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="64" aria-valuetext="64%"/);
    expect(out).toContain(">64%<");
    expect(out).toMatch(/class="striped absolute[^"]*bg-primary[^"]*" style="width:64%"/);
  });
  it("a value text replaces the percent; a failed task fills red", () => {
    const out = html(h(Progress, { label: "Files", value: 3, max: 5, valueText: "3 of 5 files", failed: true }));
    expect(out).toContain('aria-valuetext="3 of 5 files"');
    expect(out).toContain("bg-down-mark");
  });
  it("indeterminate: no value read, the sliding third", () => {
    const out = html(h(Progress, { label: "Preparing" }));
    expect(out).not.toContain("aria-valuenow");
    expect(out).toContain("animate-progress w-1/3");
  });
});

describe("Timeline", () => {
  const items = [
    { id: "1", title: "Submitted", status: "done" as const, at: Date.UTC(2026, 9, 1), actor: "Rina" },
    { id: "2", title: "Manager approval", status: "current" as const, note: "Waiting for Bima" },
    { id: "3", title: "Finance", status: "upcoming" as const },
  ];
  it("an ordered list named by its label; the current step has aria-current=step; each step says its status in words", () => {
    const out = html(h(Timeline, { items, label: "Approval" }));
    expect(out).toMatch(/^<ol aria-label="Approval"/);
    expect(out).toMatch(/<li aria-current="step"[^>]*>.*Manager approval/);
    for (const s of ["Done", "In progress", "Not started"]) expect(out).toContain(`>${s}<`);
    expect(out).toContain("Waiting for Bima");
  });
});

describe("Disclosure", () => {
  it("a native details with a summary and a turning chevron", () => {
    const out = html(h(Disclosure, { summary: "Advanced", children: "Body" }));
    expect(out).toMatch(/^<details class="group/);
    expect(out).toMatch(/<summary[^>]*>.*Advanced.*group-open:rotate-180/);
  });
});
