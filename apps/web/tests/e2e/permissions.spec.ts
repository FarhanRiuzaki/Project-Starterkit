import { expect, test } from "@playwright/test";
import { csrfOf, demoIds, heading, signIn, withIds } from "./helpers";

/**
 * The Viewer role (user.view + audit.view): the menu hides what the role can't open, the API refuses it even when
 * called directly with a valid session and CSRF token, and a page it can't open is a 404 "Page not found".
 */
test("viewer: menu, direct API call and direct page", async ({ page, baseURL }) => {
  const { superadminRole } = await demoIds(baseURL);
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

  // A document load of a page the role can't open is a real 404 (the (main) layout checks before streaming), with
  // nothing about the page or its data in the answer.
  for (const path of ["/roles", "/roles/{adminRole}", "/permissions", "/users/new", "/users/{superadmin}/edit"]) {
    const direct = await page.goto(await withIds(path, baseURL));
    expect(direct?.status(), path).toBe(404);
    const html = await direct!.text();
    for (const leak of ['href="/roles/', superadminRole, "Every permission", "Permissions of", "Create user", "Edit user", ">Roles<", ">Permissions<"]) {
      expect(html, `${path} leaks ${leak}`).not.toContain(leak);
    }
    await heading(page, "Page not found");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
  }
});

/** An Admin may open a Superadmin's edit page (user.edit) but holds fewer permissions: fields read, Save is blocked with the rank reason. */
test("admin: a Superadmin's edit page is read-only with the blocked Save", async ({ page, baseURL }) => {
  await signIn(page, "admin@example.com");
  await expect(page).toHaveURL("/");
  await page.goto(await withIds("/users/{superadmin}/edit", baseURL));
  await heading(page, "Edit user");
  await expect(page.locator("#u-name")).toBeDisabled();
  const save = page.getByRole("button", { name: "Save user" });
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).toHaveAccessibleDescription("This user has permissions your role doesn't hold. Ask an administrator who has all of them.");
});
