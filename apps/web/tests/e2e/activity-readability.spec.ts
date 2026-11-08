import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, csrfOf, expectNoHorizontalScroll } from "./helpers";

test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

test("real project create, update and delete remain readable through activity JSON, detail and CSV", async ({ page }) => {
  await page.goto("/projects");
  const csrf = await csrfOf(page), headers = { "x-csrf-token": csrf };
  const name = `Activity ${Date.now()}`;
  const created = await page.request.post("/api/projects", { headers, data: { name, description: "Recorded description" } });
  expect(created.status()).toBe(201);
  const project = await created.json();
  let deleted = false;
  try {
    expect((await page.request.patch(`/api/projects/${project.id}`, { headers, data: { name: `${name} renamed`, description: "" } })).ok()).toBe(true);
    expect((await page.request.delete(`/api/projects/${project.id}`, { headers })).ok()).toBe(true); deleted = true;
    for (const [action, title, heading] of [["project.create", "Project created", "Initial values"], ["project.update", "Project updated", "Changes"], ["project.delete", "Project deleted", "Values before deletion"]]) {
      const query = `action=${action}`;
      const result = await page.request.get(`/api/audit/activity?${query}`);
      expect(result.ok()).toBe(true);
      const entry = (await result.json()).items.find((r: { target: { id: string } }) => r.target.id === project.id);
      expect(entry).toBeTruthy();
      await page.goto(`/audit/activity?${query}`);
      const trigger = page.getByRole("button", { name: `View entry: ${title}, ${entry.target.label}`, exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      await expect(dialog.getByText(`By Super Admin · Project: ${entry.target.label}`, { exact: true })).toBeVisible();
      await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (action === "project.update") {
        await expect(dialog.getByText("Before", { exact: true }).first()).toBeVisible();
        await expect(dialog.getByText("After", { exact: true }).first()).toBeVisible();
        const csv = await (await page.request.get(`/api/audit/activity?${query}&format=csv`)).text();
        expect(csv).toContain(`Name: ${name} → ${name} renamed`);
        expect(csv).toContain("Description: Recorded description → Not set");
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  } finally { if (!deleted) await page.request.delete(`/api/projects/${project.id}`, { headers }); }
});

/** Legacy/presence fixtures are explicitly test-only recorded events, inserted in the isolated E2E DB, not production writes. */
function recordedFixtures(marker: string) {
  if (!new URL(process.env.E2E_DB ?? "").pathname.endsWith("_e2e")) throw new Error("Fixture requires isolated E2E DB");
  const rows = [
    { action: "role.update", before: { name: "Reviewers" }, after: { name: "Editors", added: ["user.edit", "user.view"], removed: [] } },
    { action: "user.update", before: { description: null, name: "", isActive: false, nested: { token: null }, ["legacy_".repeat(20)]: ["a, b"] }, after: { description: "", name: null, isActive: true, nested: { token: "legacy-secret-canary" }, ["legacy_".repeat(20)]: ["a", "b"] } },
    { action: "user.assign_role", before: { roles: ["Viewer", "Editor"] }, after: { roles: ["Editor", "Viewer"] } },
    { action: "me.password", before: null, after: null },
    { action: "legacy.event", before: 12, after: { nested: { recoveryCodes: ["legacy-secret-canary"] }, unknown: ["z", "a"] } },
    { action: "role.delete", before: { name: "Removed role", permissions: ["user.view"] }, after: null },
    { action: "user.create", before: null, after: { name: "Recorded user", roles: ["Viewer"], invited: true } },
    ...["constructor", "__proto__", "toString"].map(action => ({ action, before: null, after: { legacy: "Recorded text" } })),
  ].map(row => ({ ...row, id: randomUUID() }));
  const script = 'import { db, client } from "./src/kernel/db.ts"; import { activity } from "./src/modules/audit/schema.ts"; import { sql } from "drizzle-orm"; const rows = JSON.parse(process.env.ACTIVITY_FIXTURES).map(r => ({...r, before: r.before === null ? null : sql`${{value:r.before}}::jsonb->\'value\'`, after: r.after === null ? null : sql`${{value:r.after}}::jsonb->\'value\'`, actorName: process.env.ACTIVITY_MARKER, targetType: "role", targetId: r.id, targetLabel: process.env.ACTIVITY_MARKER})); await db.insert(activity).values(rows); await client.close();';
  execFileSync("bun", ["-e", script], { cwd: path.resolve(import.meta.dirname, "../../../../apps/api"), env: { ...process.env, DATABASE_URL: process.env.E2E_DB, ACTIVITY_MARKER: marker, ACTIVITY_FIXTURES: JSON.stringify(rows) }, stdio: "pipe" });
  return rows;
}

for (const width of [360, 390, 834, 1440]) for (const colorScheme of ["light", "dark"] as const) test(`${width} ${colorScheme}: recorded audit semantics wrap and preserve dialog keyboard behavior`, async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const marker = `Recorded ${randomUUID().slice(0, 8)}`;
  const rows = recordedFixtures(marker);
  const context = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width, height: width < 768 ? 844 : 1000 }, colorScheme, reducedMotion: "reduce", hasTouch: width < 1280, isMobile: width < 768 });
  try {
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", error => failures.push(error.message));
    page.on("console", message => { if (message.type() === "error") failures.push(message.text()); });
    await page.goto(`/audit/activity?user=${encodeURIComponent(marker)}`);
    await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
    await expect(page.getByRole("heading", { level: 1, name: "Activity log" })).toBeVisible();
    for (const [index, row] of rows.entries()) {
      const labels: Record<string, string> = { "role.update": "Role updated", "user.update": "User updated", "user.assign_role": "Role assigned", "me.password": "Own password changed", "role.delete": "Role deleted", "user.create": "User created" };
      const label = Object.hasOwn(labels, row.action) ? labels[row.action]! : row.action;
      const trigger = page.getByRole("button", { name: `View entry: ${label}, ${marker}`, exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: label, exact: true });
      await expect(dialog.getByText(`By ${marker} · Role: ${marker}`, { exact: true })).toBeVisible();
      await expect(dialog).toBeFocused();
      if (index === 0) {
        await expect(dialog.getByText("Permissions added", { exact: true })).toBeVisible();
        await expect(dialog.getByText("user.edit, user.view", { exact: true })).toBeVisible();
      } else if (index === 1) {
        for (const text of ["Not set", "Empty text", "Active", "Inactive", "Before", "After"]) await expect(dialog.getByText(text, { exact: true }).first()).toBeVisible();
        await expect(dialog).not.toContainText("legacy-secret-canary");
      } else if (index === 2) await expect(dialog.getByText("No field changes are shown for the recorded values.", { exact: true })).toBeVisible();
      else if (index === 3) await expect(dialog.getByText("Field values were not recorded for this event.", { exact: true })).toBeVisible();
      else if (index === 4) { await expect(dialog.getByText("Recorded values", { exact: true })).toBeVisible(); await expect(dialog).not.toContainText("legacy-secret-canary"); }
      else if (index === 5) await expect(dialog.getByText("Permissions before deletion", { exact: true })).toBeVisible();
      else if (index === 6) await expect(dialog.getByRole("heading", { name: "Initial values", exact: true })).toBeVisible();
      else await expect(dialog.getByText("Recorded text", { exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: path.join(SCRATCH, `batch-a-audit-${width}-${colorScheme}-${index}.png`), animations: "disabled", scale: "css" });
      if (index === 1) {
        await dialog.getByText("legacy_".repeat(20), { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(SCRATCH, `batch-a-audit-${width}-${colorScheme}-long-values.png`), animations: "disabled", scale: "css" });
      }
      if (index === 0) expect(await axeSerious(page)).toEqual([]);
      if (index % 2) await dialog.getByRole("button", { name: "Close", exact: true }).click();
      else await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    expect(failures).toEqual([]);
  } finally { await context.close(); }
});
