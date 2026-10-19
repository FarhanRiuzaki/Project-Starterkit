import { expect, test } from "@playwright/test";
import { csrfOf, heading, signIn } from "./helpers";

/**
 * The Viewer role (user.view + audit.view): the menu hides what the role can't open, the API refuses it even when
 * called directly with a valid session and CSRF token, and a page it can't open is "Page not found".
 */
test("viewer: menu, direct API call and direct page", async ({ page }) => {
  await signIn(page, "viewer@example.com");
  await expect(page).toHaveURL("/");

  const menu = page.getByRole("navigation", { name: "Menu" });
  for (const name of ["Dashboard", "Users", "Activity log", "Sign-in log", "Profile"]) await expect(menu.getByRole("link", { name })).toBeVisible();
  for (const name of ["Roles", "Permissions"]) await expect(menu.getByRole("link", { name })).toHaveCount(0);

  const user = { name: "Not Created", username: "not.created", email: "not.created@example.com", roles: [], password: "Password123!x" };
  const post = (token: string) => page.request.post("/api/users", { headers: { "x-csrf-token": token }, data: user });
  // A wrong token is refused as csrf first: so the 403 below is the permission check, with a token the server took.
  const bad = await post("not-the-token");
  expect(bad.status()).toBe(403);
  expect((await bad.json()).error.code).toBe("csrf");
  const res = await post(await csrfOf(page));
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({ error: { code: "forbidden", message: expect.any(String) } });
  const roles = await page.request.get("/api/roles");
  expect(roles.status()).toBe(403);

  const users = await page.request.get("/api/users?q=not.created");
  expect((await users.json()).total, "nothing was created").toBe(0);

  const direct = await page.goto("/roles");
  // The page streams (loading.tsx), so Next answers 200 and marks it noindex (docs: not-found.js, Status codes).
  expect([200, 404]).toContain(direct?.status());
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  expect(await direct!.text(), "no role data in the page").not.toContain('href="/roles/role-');
  await heading(page, "Page not found");
  await expect(page.getByRole("main")).toHaveCount(1); // inside the shell: one main landmark
  await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
});
