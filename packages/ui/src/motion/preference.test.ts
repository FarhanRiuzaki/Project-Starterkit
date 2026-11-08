// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ReducedMotionScope } from "./preference";
import { usePrefersReducedMotion } from "./reduced-motion";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ""; vi.restoreAllMocks(); });
function Demo() { const reduced = usePrefersReducedMotion(); return h("div", null, h("output", null, reduced ? "reduced" : "full"), h("input", { defaultValue: "draft" })); }
async function render(active: boolean) {
  if (!root) { const el = document.createElement("div"); document.body.append(el); root = createRoot(el); }
  await act(async () => root!.render(h(ReducedMotionScope, { active, children: h(ReducedMotionScope, { active: false, children: h(Demo) }) })));
}
it("nested scopes cannot re-enable motion and preference changes retain draft and focus", async () => {
  await render(false);
  const input = document.querySelector("input")!; input.value = "An edited draft"; input.focus();
  await render(true);
  expect(document.querySelector("output")!.textContent).toBe("reduced");
  expect(document.querySelector("input")).toBe(input);
  expect(input.value).toBe("An edited draft");
  expect(document.activeElement).toBe(input);
  await render(false);
  expect(document.querySelector("output")!.textContent).toBe("full");
});
it("an inactive local preview cannot override the system's reduced-motion preference", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
  await render(false);
  expect(document.querySelector("output")!.textContent).toBe("reduced");
});
