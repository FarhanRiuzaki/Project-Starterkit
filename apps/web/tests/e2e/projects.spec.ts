import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { heading } from "./helpers";

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
