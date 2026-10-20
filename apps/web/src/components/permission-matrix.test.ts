// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@starterkit/ui/ui/tooltip";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { PermissionMatrix } from "./permission-matrix";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The viewer lacks role.delete: that cell is read-only with its reason. */
const ALLOWED: ReadonlySet<PermissionName> = new Set(PERMISSIONS.filter((p) => p !== "role.delete"));
function Harness() {
  const [value, setValue] = useState<ReadonlySet<string>>(new Set(["user.view"]));
  return h(TooltipProvider, null, h(PermissionMatrix, { label: "Permissions of Test", value, allowed: ALLOWED, onChange: (edit) => setValue((v) => edit(v)) }));
}

let root: Root | null = null;
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; });
const box = (name: string) => document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${name}"]`)!;
const status = () => document.querySelector('[role="status"]')!.textContent;

/** Touch path (responsive spec "Matrix permission"): a press on a read-only cell says why; the next change clears it. */
describe("PermissionMatrix reason note", () => {
  it("a press on a read-only cell shows its reason; a press that toggles a writable cell clears it", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(h(Harness)));
    expect(status()).toBe("");
    await act(async () => box("Delete role").click());
    expect(status()).toBe("Delete role: Your role doesn't hold this permission, so you can't grant or remove it.");
    await act(async () => box("Create user").click());
    expect(box("Create user").getAttribute("aria-checked")).toBe("true");
    expect(status()).toBe("");
  });
});
