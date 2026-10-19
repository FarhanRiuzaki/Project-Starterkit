import { expect, test } from "@playwright/test";
import { heading, SEED, signIn, totp } from "./helpers";

/**
 * Sign-in end to end, one seed account per method, each in a fresh browser context (no shared session is touched).
 * Every sign-in counts against the sign-in rate limit, so each method signs in once.
 */
const account = (name: string) => `${name}, account menu`;

test("password: email or username and password lands on the dashboard", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page).toHaveURL("/");
  await heading(page, "Dashboard");
  await expect(page.getByRole("button", { name: account("Admin User") })).toBeVisible();
});

test("two-factor: password, then the one-time code from the seed secret", async ({ page }) => {
  await signIn(page, "twofa@example.com");
  await expect(page).toHaveURL("/login/2fa");
  await heading(page, "Two-factor authentication");
  await page.locator("#code").fill(totp(SEED.totpSecret)); // submits itself at 6 digits
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: account("Two Factor") })).toBeVisible();
});

test("OAuth: Continue with Google signs in as the connected seed user", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: account("Google User") })).toBeVisible();
});

test("LDAP: directory username and directory password", async ({ page }) => {
  await signIn(page, "ldap", SEED.ldapPassword, "LDAP");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: account("Directory User") })).toBeVisible();
});

test("sign out, then a signed-in page sends to sign-in with the page as next", async ({ page }) => {
  await page.goto("/api/auth/oauth/apple"); // no password sign-in: spares the rate limit
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: account("Apple User") }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  expect((await page.context().cookies()).map((c) => c.name)).not.toContain("sk_session");
  await page.goto("/users");
  await expect(page).toHaveURL("/login?next=%2Fusers");
  await heading(page, "Sign in");
});
