import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { csrfOf, demoIds, heading } from "./helpers";

test.use({ storageState: AUTH_STATE });

/** Create through the form (an empty name is said, not sent), edit, then delete through the confirm dialog. */
test("projects: create, edit, delete", async ({ page }) => {
  const name = `E2E project ${Date.now()}`;
  await page.goto("/projects");
  await heading(page, "Projects");
  await page.getByRole("link", { name: "Create project" }).click();
  await heading(page, "Create project");

  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();

  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Description" }).fill("Made by the E2E run.");
  await page.getByRole("button", { name: "Create project" }).click();
  await heading(page, name);
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);

  await page.getByRole("link", { name: "Edit project" }).click();
  await heading(page, "Edit project");
  await page.getByRole("radio", { name: "Archived" }).check();
  await page.getByRole("button", { name: "Save project" }).click();
  await heading(page, name);
  await expect(page.getByText("Archived").first()).toBeVisible();

  await page.getByRole("button", { name: "Delete project" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("This can't be undone.");
  await dialog.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

test("projects: dirty Cancel preserves drafts until Leave page; clean Cancel has a deterministic destination", async ({ page, baseURL }) => {
  await page.goto("/projects/new");
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Unsaved project");
  const cancel = page.getByRole("link", { name: "Cancel", exact: true });
  // A button on the old form bypassed the shared leave guard entirely.
  await expect(cancel).toBeVisible();
  await cancel.click();
  const dialog = page.getByRole("dialog", { name: "Leave without saving" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(name).toHaveValue("Unsaved project");
  await expect(cancel).toBeFocused();
  await cancel.click();
  await page.keyboard.press("Escape");
  await expect(cancel).toBeFocused();
  await expect(name).toHaveValue("Unsaved project");
  await cancel.click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(cancel).toBeFocused();
  await cancel.click();
  await dialog.getByRole("button", { name: "Leave page", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const ids = await demoIds(baseURL);
  await page.goto(`/projects/${ids.project}/edit`);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${ids.project}$`));
});

test("projects: duplicate identifies Name and keeps the other draft fields", async ({ page }) => {
  await page.goto("/projects/new");
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Apollo");
  await page.getByRole("textbox", { name: "Description" }).fill("Keep this description");
  await page.getByRole("radio", { name: "Archived", exact: true }).check();
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toContainText("Name");
  await expect(page.getByRole("textbox", { name: "Description" })).toHaveValue("Keep this description");
  await expect(page.getByRole("radio", { name: "Archived", exact: true })).toBeChecked();
  await name.fill(`Recovered ${Date.now()}`);
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
});

test("projects: canonical trim is shared by validation and payload in create and edit", async ({ page }) => {
  await page.goto("/projects/new");
  const canonical = `Trim ${Date.now()} `.padEnd(100, "x");
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill(` ${canonical} `);
  await page.getByRole("textbox", { name: "Description" }).fill(` ${"d".repeat(500)} `);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await heading(page, canonical);
  const detail = new URL(page.url()).pathname;
  const persisted = await (await page.request.get(`/api${detail}`)).json();
  expect(persisted.name).toBe(canonical);
  expect(persisted.description).toBe("d".repeat(500));
  await page.goto(`${detail}/edit`);
  await name.fill(` ${"n".repeat(101)} `);
  await name.press("Enter");
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill(` ${canonical} `);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${detail}$`));
  const csrf = await csrfOf(page);
  expect((await page.request.delete(`/api${detail}`, { headers: { "x-csrf-token": csrf } })).ok()).toBe(true);
});

test("projects: failed edit refresh keeps draft and offers recovery", async ({ page, baseURL }) => {
  const ids = await demoIds(baseURL);
  await page.goto(`/projects/${ids.project}/edit`);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(name).toHaveValue("Apollo");
  await name.fill("Apollo local draft");
  let fail = true;
  let failures = 0;
  await page.route(`**/api/projects/${ids.project}`, async route => {
    if (!fail) return route.continue();
    failures++;
    return route.fulfill({ status: 500, json: { error: { code: "internal", message: "The request could not be completed. Try again." } } });
  });
  await page.context().setOffline(true);
  await page.waitForTimeout(11_000); // cached data's staleTime is 10 seconds
  await page.context().setOffline(false);
  await expect.poll(() => failures).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("Couldn't refresh this project; showing the last loaded details.")).toBeVisible();
  await expect(name).toHaveValue("Apollo local draft");
  fail = false;
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect(page.getByText("Couldn't refresh this project; showing the last loaded details.")).toHaveCount(0);
  await expect(name).toHaveValue("Apollo local draft");
});

for (const mode of ["create", "edit"] as const) {
  test(`projects: ${mode} saving freezes the snapshot and blocks Cancel and duplicate submits`, async ({ page }) => {
    await page.goto("/projects");
    const csrf = await csrfOf(page);
    const label = `Pending ${mode} ${Date.now()}`;
    let id: string | undefined;
    if (mode === "edit") {
      const response = await page.request.post("/api/projects", { headers: { "x-csrf-token": csrf }, data: { name: label } });
      expect(response.status()).toBe(201);
      id = (await response.json()).id;
    }
    await page.goto(mode === "edit" ? `/projects/${id}/edit` : "/projects/new");
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    await name.fill(`${label} saved`);
    const description = page.getByRole("textbox", { name: "Description" });
    await description.fill("Frozen snapshot");
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let mutations = 0;
    let payload: unknown;
    await page.route(mode === "edit" ? `**/api/projects/${id}` : "**/api/projects", async route => {
      if (route.request().method() !== (mode === "edit" ? "PATCH" : "POST")) return route.continue();
      mutations++;
      payload = route.request().postDataJSON();
      await held;
      return route.continue();
    });
    try {
      const submit = page.getByRole("button", { name: mode === "edit" ? "Save project" : "Create project", exact: true });
      await submit.click();
      await expect.poll(() => mutations).toBe(1);
      await expect(name).toBeDisabled();
      await expect(description).toBeDisabled();
      await expect(page.getByRole("radio", { name: "Archived", exact: true })).toBeDisabled();
      const cancel = page.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeDisabled();
      const before = page.url();
      await cancel.click({ force: true });
      await cancel.press("Enter");
      await submit.press("Enter");
      await page.locator('form[aria-label]').evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
      expect(page.url()).toBe(before);
      expect(mutations).toBe(1);
      expect(payload).toEqual({ name: `${label} saved`, description: "Frozen snapshot", status: "active" });
      release();
      await heading(page, `${label} saved`);
      const detail = new URL(page.url()).pathname;
      expect((await page.request.delete(`/api${detail}`, { headers: { "x-csrf-token": csrf } })).ok()).toBe(true);
    } finally { release(); }
  });
}

test("projects: clean create and dirty edit Cancel, every field and breadcrumb focus", async ({ page, baseURL }) => {
  await page.goto("/projects/new");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const ids = await demoIds(baseURL);
  await page.goto(`/projects/${ids.project}/edit`);
  const description = page.getByRole("textbox", { name: "Description" });
  await description.fill("Unsaved description");
  await page.getByRole("radio", { name: "Archived", exact: true }).check();
  const cancel = page.getByRole("link", { name: "Cancel", exact: true });
  await cancel.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Leave without saving" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cancel).toBeFocused();
  await expect(description).toHaveValue("Unsaved description");
  await expect(page.getByRole("radio", { name: "Archived", exact: true })).toBeChecked();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Apollo", exact: true });
  await breadcrumb.click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(breadcrumb).toBeFocused();
  await cancel.click();
  await dialog.getByRole("button", { name: "Leave page", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${ids.project}$`));
});
