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
  test.setTimeout(60_000);
  await signIn(page, "twofa@example.com");
  await expect(page).toHaveURL("/login/2fa");
  await heading(page, "Two-factor authentication");
  // Each TOTP code completes one sign-in only (replay guard). A rerun against a reused server (E2E_REUSE=1) within the
  // same 30 s step finds the current code spent: then wait for the next step and use its code.
  await page.locator("#code").fill(totp(SEED.totpSecret)); // submits itself at 6 digits
  const landed = await page.waitForURL("/", { timeout: 3000 }).then(() => true, () => false);
  if (!landed) {
    await expect(page.getByRole("alert")).toBeVisible();
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
    await page.locator("#code").fill(totp(SEED.totpSecret));
  }
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: account("Two Factor") })).toBeVisible();
});

test("OAuth: Continue with Google signs in as the connected seed user", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: account("Google User") })).toBeVisible();
});

test("connect Google from /me/security shows the connected state and a toast", async ({ page }) => {
  await page.goto("/api/auth/oauth/apple"); // Apple User, connected to Apple only
  await expect(page).toHaveURL("/");
  await page.goto("/me/security");
  const google = page.getByRole("listitem").filter({ hasText: /^Google/ }); // not the toast ("Connected Google.")
  await expect(google).toContainText("Not connected");
  await google.getByRole("link", { name: "Connect Google" }).click(); // the mock provider's redirect round trip
  await expect(page.getByText("Connected Google.")).toBeVisible();
  await expect(page).toHaveURL("/me/security"); // the parameter is dropped once toasted
  await expect(google).not.toContainText("Not connected");
  await expect(google.getByRole("button", { name: "Disconnect Google" })).toBeVisible();
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
