// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ActivityEntryLoader } from "./activity-entry-loader";

const deferred = vi.hoisted(() => {
  let release!: () => void;
  return { hold: new Promise<void>(resolve => { release = resolve; }), release: () => release(), resolved: false };
});
vi.mock("./activity-entry-dialog", async () => {
  await deferred.hold; deferred.resolved = true;
  return { ActivityEntryDialog: () => h("section", { role: "dialog" }, "Loaded entry") };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("Cancel invalidates a held import immediately, even while Back has not changed the URL", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  window.history.replaceState(null, "", `/audit/activity?entry=${id}`);
  const close = vi.fn(), returnFocus = vi.fn();
  const entry = { present: true, id, close, returnFocus, open: vi.fn(), investigate: vi.fn() };
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const render = () => h(ActivityEntryLoader, { entry, children: notice => h("main", null, notice) });
  try {
    await act(async () => root.render(render()));
    expect(container.textContent).toContain("Opening activity entry…");
    await act(async () => container.querySelector("button")!.click());
    expect(close).toHaveBeenCalledOnce();
    expect(window.location.search).toContain("entry="); // Back is deliberately delayed.
    await act(async () => { deferred.release(); await deferred.hold; });
    await vi.waitFor(() => expect(deferred.resolved).toBe(true));
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(returnFocus).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/audit/activity");
    entry.present = false;
    await act(async () => root.render(render()));
    await vi.waitFor(() => expect(returnFocus).toHaveBeenCalledOnce());
  } finally { await act(async () => root.unmount()); container.remove(); }
});
