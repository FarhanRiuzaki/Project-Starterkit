import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { csrfOf } from "./helpers";

test.use({ storageState: AUTH_STATE });
test("bulk confirmation retries a failed dependency with the same full filtered set and one successful mutation", async ({ page }) => {
  await page.goto("/users");
  const csrf = await csrfOf(page);
  const prefix = `bulk-probe-${Date.now()}`;
  const ids: string[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const payloads: unknown[] = [];
  try {
    for (let n = 0; n < 16; n++) {
      const created = await page.request.post("/api/users", { headers: { "x-csrf-token": csrf }, data: { name: `${prefix} ${n}`, username: `${prefix}-${n}`, email: `${prefix}-${n}@example.test`, isLdap: true, isActive: false, roles: ["Viewer"] } });
      expect(created.ok()).toBe(true); ids.push((await created.json()).id);
    }
    await page.goto(`/users?${new URLSearchParams({ q: prefix, role: "Viewer" })}&status=active&status=inactive`);
    await page.route("**/api/users/bulk", async route => {
      payloads.push(route.request().postDataJSON());
      // Controlled dependency failure: the first proof must keep selection and allow retry.
      if (payloads.length === 1) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "Something went wrong. Try again." } }) });
      const response = await route.fetch(); await held; await route.fulfill({ response });
    });
    await page.getByRole("checkbox", { name: "Select all 15 on this page", exact: true }).first().check();
    await page.getByRole("button", { name: "Select all 16 users", exact: true }).click();
    const bulk = page.getByRole("region", { name: "Bulk actions", exact: true, includeHidden: true });
    await bulk.getByRole("button", { name: "Activate", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Activate 16 users", exact: true });
    await expect(dialog).toBeVisible(); expect(payloads).toHaveLength(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); expect(payloads).toHaveLength(0);
    await bulk.getByRole("button", { name: "Activate", exact: true }).click();
    const confirm = dialog.getByRole("button", { name: "Activate users", exact: true });
    await confirm.click(); await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog).toBeVisible(); await expect(bulk).toContainText("All 16 selected");
    await confirm.click(); await expect(confirm).toBeDisabled();
    await expect.poll(() => payloads.length).toBe(2);
    expect(payloads[0]).toEqual({ action: "activate", filter: { q: prefix, role: ["Viewer"], status: ["active", "inactive"] } });
    expect(payloads[1]).toEqual(payloads[0]);
    release(); await expect(dialog).toBeHidden();
    await expect(page.getByText("16 updated, 0 skipped", { exact: true })).toBeVisible();
    const result = await page.request.get(`/api/users?${new URLSearchParams({ q: prefix, status: "active", pageSize: "100" })}`);
    expect((await result.json()).total).toBe(16);
    await expect(bulk).toBeHidden();
  } finally {
    release(); await page.unroute("**/api/users/bulk");
    if (ids.length) expect((await page.request.post("/api/users/bulk", { headers: { "x-csrf-token": csrf }, data: { action: "delete", ids } })).ok()).toBe(true);
  }
});
