// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, menuLoader } from "./dropdown-menu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });

describe("deferred overlay in the browser", () => {
  it("a press on the stand-in of an uncontrolled menu opens it and tells onOpenChange, as the Radix trigger does", async () => {
    const onOpenChange = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(h(DropdownMenu, { onOpenChange },
      h(DropdownMenuTrigger, null, "Views"),
      h(DropdownMenuContent, null, h(DropdownMenuItem, null, "Save view as…")))));
    const trigger = host.querySelector("button")!;
    expect(trigger.id).toBe(""); // the stand-in: the Radix trigger carries a generated id
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
      await menuLoader.load();
    });
    expect(document.body.textContent).toContain("Save view as…");
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
