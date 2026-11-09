// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useActivityEntry } from "./use-activity-entry";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let navigation: ReturnType<typeof useActivityEntry>;
const A = "00000000-0000-4000-8000-000000000001", B = "00000000-0000-4000-8000-000000000002";
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; vi.restoreAllMocks(); });
async function mount() {
  window.history.replaceState(null, "", "/audit/activity?range=7d");
  function Demo() { navigation = useActivityEntry(); return h("main", { id: "content" }, h("h1", { tabIndex: -1 }, "Activity log"), h("button", { id: "entry-trigger" }, "Entry A")); }
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(h(Demo)));
  return document.getElementById("entry-trigger") as HTMLButtonElement;
}
it("Close replaces only entry when list context changes despite retaining the old history marker", async () => {
  const trigger = await mount();
  await act(async () => navigation.open(A, trigger));
  window.history.replaceState({ ...window.history.state }, "", `/audit/activity?range=90d&user=Changed&entry=${A}`);
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  await act(async () => navigation.close());
  expect(back).not.toHaveBeenCalled();
  expect(window.location.search).toBe("?range=90d&user=Changed");
});
it("a direct B after row A returns focus to the heading, never A's still-connected button", async () => {
  const trigger = await mount();
  await act(async () => navigation.open(A, trigger));
  window.history.replaceState(null, "", `/audit/activity?entry=${B}`);
  await act(async () => { navigation.close(); navigation.returnFocus(B); });
  expect(document.activeElement).toBe(document.querySelector("h1"));
});
it("an old callback cannot change the route or focus after leaving Activity", async () => {
  const trigger = await mount();
  await act(async () => navigation.open(A, trigger));
  window.history.replaceState(null, "", "/projects?status=archived");
  const before = window.location.href;
  await act(async () => { navigation.close(); navigation.investigate(A, { actorId: A }); navigation.returnFocus(A); });
  expect(window.location.href).toBe(before);
  expect(document.activeElement).not.toBe(trigger);
});
it("switching owned A to B replaces its slot and keeps only the known list Back provenance", async () => {
  const trigger = await mount();
  await act(async () => navigation.open(A, trigger));
  const marker = window.history.state.skActivityEntry;
  const push = vi.spyOn(window.history, "pushState"), replace = vi.spyOn(window.history, "replaceState");
  await act(async () => navigation.open(B, trigger));
  expect(push).not.toHaveBeenCalled(); expect(replace).toHaveBeenCalledOnce();
  expect(window.history.state.skActivityEntry).toBe(marker);
  expect(new URLSearchParams(window.location.search).get("entry")).toBe(B);
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  await act(async () => navigation.close());
  expect(back).toHaveBeenCalledOnce();
});
it("switching a direct A to B never manufactures list Back provenance or copies Next's reserved state", async () => {
  const trigger = await mount();
  window.history.replaceState({ __NA: true }, "", `/audit/activity?range=90d&entry=${A}`);
  const push = vi.spyOn(window.history, "pushState"), replace = vi.spyOn(window.history, "replaceState");
  await act(async () => navigation.open(B, trigger));
  expect(push).not.toHaveBeenCalled();
  expect(replace.mock.calls[0]?.[0]).toBeNull();
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  await act(async () => navigation.close());
  expect(back).not.toHaveBeenCalled();
  expect(window.location.search).toBe("?range=90d");
});
