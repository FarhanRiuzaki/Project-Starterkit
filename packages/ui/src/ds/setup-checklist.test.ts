// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetupChecklist, type SetupGroup } from "./setup-checklist";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ""; });
async function mount(node: Parameters<Root["render"]>[0]) {
  const el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => root!.render(node));
  return el;
}

const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el);
const task = (id: string, done: boolean, extra: Partial<SetupGroup["tasks"][number]> = {}) => ({ id, label: `Task ${id}`, done, ...extra });
const groups: SetupGroup[] = [
  { id: "security", label: "Security", tasks: [task("a", true), task("b", true)] },
  { id: "people", label: "People", tasks: [task("c", false, { description: "One address per line", action: { label: "Invite user", href: "/users/new" } }), task("d", true), task("e", false)] },
  { id: "access", label: "Access", tasks: [task("f", false)] },
];

describe("SetupChecklist (markup)", () => {
  it("counts every task: the summary as text and as the progress bar's value, named by the title", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups }));
    expect(out).toMatch(/^<div data-slot="setup-checklist"/);
    expect(out).toContain(">3 of 6 done</p>");
    // The count is announced when it changes (a task done), not on first paint.
    expect(out).toMatch(/<p aria-live="polite" aria-atomic="true"[^>]*>3 of 6 done<\/p>/);
    expect(out).toMatch(/role="progressbar" aria-label="Finish setup" aria-valuemin="0" aria-valuemax="6" aria-valuenow="3" aria-valuetext="3 of 6 done"/);
    expect(out).toContain('style="width:50%"');
  });
  it("the caller's progress text replaces the default in both places", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups, progressText: "Half way there" }));
    expect(out).toContain(">Half way there</p>");
    expect(out).toContain('aria-valuetext="Half way there"');
    expect(out).not.toContain("3 of 6 done");
  });
  it("the heading level is the caller's (h2 unless set)", () => {
    expect(html(h(SetupChecklist, { title: "Finish setup", groups }))).toMatch(/<h2 [^>]*>Finish setup<\/h2>/);
    expect(html(h(SetupChecklist, { title: "Finish setup", groups, headingLevel: 3 }))).toMatch(/<h3 [^>]*>Finish setup<\/h3>/);
  });
  it("a list of groups, each a native details with its own count; only the first group with a task left is open", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups }));
    expect(out.match(/<li data-slot="setup-group"/g)).toHaveLength(3);
    expect(out.match(/<details/g)).toHaveLength(3);
    expect(out.match(/<details open=""/g)).toHaveLength(1);
    expect(out).toMatch(/<details open=""[^>]*><summary[^>]*>.*?People.*?1 of 3<span class="sr-only"> Done<\/span>/);
    expect(out).toMatch(/Security.*?2 of 2<span class="sr-only"> Done<\/span>/);
    expect(out.match(/<ul/g)).toHaveLength(4);
  });
  it("a done task: the check, the word Done as real text and no action; a task left: an empty marker and its action", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups }));
    const rows = out.split('<li data-slot="setup-task"').slice(1);
    expect(rows).toHaveLength(6);
    const done = rows[3]!, left = rows[2]!;
    expect(done).toMatch(/^ data-done="true"/);
    expect(done).toMatch(/data-slot="step-marker" data-status="done" aria-hidden="true"[^>]*><svg/);
    expect(done).toContain(">Done</span>");
    expect(done).not.toContain("line-through");
    expect(left).not.toContain("data-done");
    expect(left).toMatch(/data-slot="step-marker" data-status="todo" aria-hidden="true"[^>]*><\/span>/);
    expect(left).toContain("One address per line");
    expect(left).toMatch(/<a href="\/users\/new" data-slot="button" data-variant="secondary" data-size="sm"[^>]*>Invite user<\/a>/);
    expect(left).not.toContain(">Done<");
  });
  it("a first render never animates a check (the tick draws only on a change)", () => {
    expect(html(h(SetupChecklist, { title: "Finish setup", groups }))).not.toContain("animate-swap");
  });
  it("the done word is the caller's, in the rows, the group counts and the default summary", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups, doneLabel: "Complete" }));
    expect(out).toContain(">3 of 6 complete</p>");
    expect(out).toContain(">Complete</span>");
    expect(out).not.toContain("Done");
  });
  it("renderLink supplies the router's link inside the button", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups, renderLink: (href: string, label: string) => h("a", { href, "data-router": "" }, label) }));
    expect(out).toMatch(/<a href="\/users\/new" data-router="" data-slot="button"[^>]*>Invite user<\/a>/);
  });
  it("every task done: the completion message in the status region instead of the groups, the bar full", () => {
    const all = groups.map((g) => ({ ...g, tasks: g.tasks.map((t) => ({ ...t, done: true })) }));
    const out = html(h(SetupChecklist, { title: "Finish setup", groups: all, completion: h("p", null, "Setup is complete.") }));
    // tabindex -1: the region takes focus when the message replaces the list the focused action was in.
    expect(out).toMatch(/<div role="status" tabindex="-1" class="(?!sr-only)[^"]*"><p>Setup is complete\.<\/p><\/div>/);
    expect(out).not.toContain("<details");
    expect(out).toContain(">6 of 6 done</p>");
    expect(out).toContain('style="width:100%"');
  });
  it("every task done without a completion message: the groups stay, all closed", () => {
    const all = groups.map((g) => ({ ...g, tasks: g.tasks.map((t) => ({ ...t, done: true })) }));
    const out = html(h(SetupChecklist, { title: "Finish setup", groups: all }));
    expect(out.match(/<details/g)).toHaveLength(3);
    expect(out).not.toContain('open=""');
  });
  it("tasks left: the status region is there (empty, off screen), so the message is announced when it arrives", () => {
    expect(html(h(SetupChecklist, { title: "Finish setup", groups, completion: "All set" }))).toContain('<div role="status" class="sr-only"></div>');
  });
  it("empty: no groups, or only groups without tasks, renders nothing; a group without tasks is left out", () => {
    expect(html(h(SetupChecklist, { title: "Finish setup", groups: [] }))).toBe("");
    expect(html(h(SetupChecklist, { title: "Finish setup", groups: [{ id: "x", label: "Empty", tasks: [] }], completion: "All set" }))).toBe("");
    const out = html(h(SetupChecklist, { title: "Finish setup", groups: [{ id: "x", label: "Empty", tasks: [] }, groups[2]!] }));
    expect(out).not.toContain("Empty");
    expect(out).toContain(">0 of 1 done</p>");
  });
  it("one task: one open group, 0 of 1, an empty bar; a task without an action has no button", () => {
    const out = html(h(SetupChecklist, { title: "Finish setup", groups: [groups[2]!] }));
    expect(out.match(/<details open=""/g)).toHaveLength(1);
    expect(out).toContain('aria-valuenow="0"');
    expect(out).toContain('style="width:0%"');
    expect(out).not.toContain('data-slot="button"');
  });
  it("long labels wrap instead of widening the card; large counts are grouped", () => {
    const long = "Connect the directory ".repeat(12).trim();
    const out = html(h(SetupChecklist, { title: long, groups: [{ id: "g", label: long, tasks: [task("z", false, { label: long, description: long })] }] }));
    expect(out.match(/break-words/g)!.length).toBeGreaterThanOrEqual(4);
    const many = Array.from({ length: 1200 }, (_, i) => task(String(i), i < 1100));
    expect(html(h(SetupChecklist, { title: "Finish setup", groups: [{ id: "g", label: "Many", tasks: many }] }))).toContain(">1,100 of 1,200 done</p>");
  });
});

describe("SetupChecklist (DOM)", () => {
  it("a callback action is a native button that runs it once and never submits a parent form", async () => {
    const onClick = vi.fn();
    const el = await mount(h("form", null, h(SetupChecklist, { title: "Finish setup", groups: [{ id: "g", label: "Access", tasks: [task("r", false, { action: { label: "Create role", onClick } })] }] })));
    const button = el.querySelector<HTMLButtonElement>('[data-slot="setup-task"] button')!;
    expect(button.type).toBe("button");
    expect(button.textContent).toBe("Create role");
    await act(async () => button.click());
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("a task that becomes done: its check enters keyed on the change; a finished group closes and the next one opens", async () => {
    const el = await mount(h(SetupChecklist, { title: "Finish setup", groups: [groups[2]!, groups[1]!] }));
    const open = () => [...el.querySelectorAll("details")].map((d) => d.hasAttribute("open"));
    expect(open()).toEqual([true, false]);
    expect(el.querySelector(".animate-swap")).toBeNull();
    const next = [{ ...groups[2]!, tasks: [task("f", true)] }, groups[1]!];
    await act(async () => root!.render(h(SetupChecklist, { title: "Finish setup", groups: next })));
    expect(open()).toEqual([false, true]);
    expect(el.querySelectorAll(".animate-swap")).toHaveLength(1);
    expect(el.querySelector('[data-slot="setup-task"][data-done] .animate-swap')).not.toBeNull();
    expect(el.querySelector('[role="progressbar"]')!.getAttribute("aria-valuetext")).toBe("2 of 4 done");
  });
  it("the last task done: the completion message fills the status region that was already there", async () => {
    const one = (done: boolean) => h(SetupChecklist, { title: "Finish setup", groups: [{ id: "g", label: "Access", tasks: [task("r", done)] }], completion: "Setup is complete." });
    const el = await mount(one(false));
    const status = el.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("");
    await act(async () => root!.render(one(true)));
    expect(el.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toBe("Setup is complete.");
    expect(el.querySelector("details")).toBeNull();
  });
});

/** A task that becomes done unmounts its action; focus that was on it must stay in the checklist (AGENTS §7). */
describe("SetupChecklist (focus after a task is done)", () => {
  const act1 = (label: string) => ({ action: { label, onClick: () => {} } });
  const two = (a: boolean, b: boolean, c: boolean, completion?: string) => h(SetupChecklist, { title: "Finish setup", completion, groups: [
    { id: "people", label: "People", tasks: [task("a", a, act1("Invite user")), task("b", b, act1("Create role"))] },
    { id: "review", label: "Review", tasks: [task("c", c, act1("Open activity log"))] },
  ] });
  const button = (el: HTMLElement, name: string) => [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name)!;
  const summary = (el: HTMLElement, i: number) => el.querySelectorAll<HTMLElement>("summary")[i]!;

  it("the next task's action in the same group; the one before when it was the last", async () => {
    const el = await mount(two(false, false, false));
    button(el, "Invite user").focus();
    await act(async () => root!.render(two(true, false, false)));
    expect(document.activeElement).toBe(button(el, "Create role"));
    await act(async () => root!.render(two(false, false, false)));
    button(el, "Create role").focus();
    await act(async () => root!.render(two(false, true, false)));
    expect(document.activeElement).toBe(button(el, "Invite user"));
  });
  it("the group's last task: the summary of the group that opens", async () => {
    const el = await mount(two(true, false, false));
    button(el, "Create role").focus();
    await act(async () => root!.render(two(true, true, false)));
    expect(el.querySelectorAll("details")[1]!.hasAttribute("open")).toBe(true);
    expect(document.activeElement).toBe(summary(el, 1));
  });
  it("the last task of all: the status region with the completion message; without a message, the group's own summary", async () => {
    const el = await mount(two(true, true, false, "Setup is complete."));
    button(el, "Open activity log").focus();
    await act(async () => root!.render(two(true, true, true, "Setup is complete.")));
    expect(document.activeElement).toBe(el.querySelector('[role="status"]'));
    await act(async () => root!.render(two(true, true, false)));
    button(el, "Open activity log").focus();
    await act(async () => root!.render(two(true, true, true)));
    expect(document.activeElement).toBe(summary(el, 1));
  });
  it("focus that is somewhere else is never taken", async () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    const el = await mount(two(false, false, false));
    button(el, "Invite user").focus();
    outside.focus();
    await act(async () => root!.render(two(true, false, false)));
    expect(document.activeElement).toBe(outside);
    // Focus that never was in the checklist: a task done by something else moves nothing.
    outside.blur();
    await act(async () => root!.render(two(true, true, false)));
    expect(el.contains(document.activeElement)).toBe(false);
  });
});
