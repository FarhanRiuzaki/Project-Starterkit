import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { csrfOf } from "./helpers";

/**
 * A permission added on the Permissions page can be given to a role: Superadmin holds it at once, and every role's
 * matrix gets a column for the new action (the bug: the matrix showed only the app's own actions).
 */
test.use({ storageState: AUTH_STATE });

test("an added permission gets its own column in a role's matrix and can be granted", async ({ page }) => {
  const action = `approve${Date.now() % 100_000}`;
  const token = await csrfOf(page);
  const added = await page.request.post("/api/permissions", { headers: { "x-csrf-token": token }, data: { names: [`user.${action}`] } });
  expect(added.status()).toBe(200);
  const viewer = (await (await page.request.get("/api/roles?q=Viewer")).json()) as { items: { id: string; name: string }[] };
  await page.goto(`/roles/${viewer.items.find((r) => r.name === "Viewer")!.id}`);
  const grid = page.getByRole("grid", { name: "Permissions of Viewer" });
  const label = action.charAt(0).toUpperCase() + action.slice(1);
  await expect(grid.getByRole("columnheader", { name: new RegExp(label) })).toBeVisible();
  const cell = grid.getByRole("checkbox", { name: `${label} user`, exact: true });
  await expect(cell).not.toHaveAttribute("aria-readonly", "true");
  await cell.click();
  await page.getByRole("button", { name: "Save permissions" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save permissions" }).click();
  await expect(page.getByText("Saved permissions for Viewer.")).toBeVisible();
  await expect(cell).toHaveAttribute("aria-checked", "true");
  // Leave the seed as it was for the other specs.
  await cell.click();
  await page.getByRole("button", { name: "Save permissions" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save permissions" }).click();
  await expect(cell).toHaveAttribute("aria-checked", "false");
});
