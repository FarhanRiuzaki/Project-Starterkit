import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { csrfOf, signIn } from "./helpers";

/**
 * Editing a role you hold changes what you may do: after the save, the toast shows and the shell (sidebar, the
 * viewer's permissions) follows without a reload.
 */
test("a user who removes a permission from their own role sees the result, and the menu drops it", async ({ browser, page }) => {
  // Set up as the seed Superadmin: a role "Ops" with role.view + role.edit, held by Admin User.
  const su = await browser.newContext({ storageState: AUTH_STATE });
  const sp = await su.newPage();
  const token = await csrfOf(sp);
  const name = `Ops ${Date.now() % 100_000}`;
  const created = await sp.request.post("/api/roles", { headers: { "x-csrf-token": token }, data: { name, permissions: ["role.view", "role.edit", "user.view"] } });
  expect(created.status()).toBe(201);
  const role = (await created.json()) as { id: string };
  const admin = (await (await sp.request.get("/api/users?q=admin%40example.com")).json()) as { items: { id: string; roles: string[] }[] };
  const adminId = admin.items[0]!.id;
  expect((await sp.request.patch(`/api/users/${adminId}`, { headers: { "x-csrf-token": token }, data: { roles: ["Admin", name] } })).status()).toBe(200);

  try {
    await signIn(page, "admin");
    await expect(page).toHaveURL("/");
    const menu = page.getByRole("navigation", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Roles" })).toBeVisible();
    await page.goto(`/roles/${role.id}`);
    await page.getByRole("checkbox", { name: "Edit role" }).click(); // view stays; edit goes
    await page.getByRole("checkbox", { name: "View role" }).click(); // and the module's view with it
    await page.getByRole("button", { name: "Save permissions" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save permissions" }).click();
    await expect(page.getByText(`Saved permissions for ${name}.`)).toBeVisible();
    // No reload: the layout refreshed with the new permission set.
    await expect(menu.getByRole("link", { name: "Roles" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1); // still inside the shell
  } finally {
    await sp.request.patch(`/api/users/${adminId}`, { headers: { "x-csrf-token": token }, data: { roles: ["Admin"] } });
    await sp.request.delete(`/api/roles/${role.id}`, { headers: { "x-csrf-token": token } });
    await su.close();
  }
});

test("editing your own account: the toast shows and the account menu follows without a reload", async ({ browser, page }) => {
  const menuButton = (p: typeof page, name: string) => p.getByRole("button", { name: `${name}, account menu` });
  // Profile: Apple User (no password sign-in spares the rate limit).
  await page.goto("/api/auth/oauth/apple");
  await expect(page).toHaveURL("/");
  await page.goto("/me");
  await page.locator("#me-name").fill("Apple Renamed");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(menuButton(page, "Apple Renamed")).toBeVisible();

  // The user editor on your own account also navigates to the detail page: Superadmin edits its own name.
  const su = await browser.newContext({ storageState: AUTH_STATE });
  const sp = await su.newPage();
  try {
    const me = (await (await sp.request.get("/api/me")).json()) as { id: string; name: string };
    await sp.goto(`/users/${me.id}/edit`);
    await sp.locator("#u-name").fill("Super Renamed");
    await sp.getByRole("button", { name: "Save user" }).click();
    await expect(sp.getByText("Saved Super Renamed.")).toBeVisible();
    await expect(sp).toHaveURL(`/users/${me.id}`);
    await expect(menuButton(sp, "Super Renamed")).toBeVisible();
    await sp.request.patch(`/api/users/${me.id}`, { headers: { "x-csrf-token": await csrfOf(sp) }, data: { name: me.name } });
  } finally {
    await su.close();
  }
});
