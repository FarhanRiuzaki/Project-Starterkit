import path from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, signIn } from "./helpers";

/**
 * axe (WCAG 2.0–2.2 A/AA): no serious or critical violation on the sign-in steps and the main screens, light and
 * dark. Signed-in pages use the superadmin session from global-setup; /login/2fa needs a sign-in waiting for its
 * second factor, made once per worker.
 */
const SIGNED_IN = ["/", "/users", "/users/u-002", "/roles/role-superadmin", "/permissions", "/audit/activity", "/audit/auth", "/me/security"];

const PENDING_2FA = path.join(SCRATCH, "pending-2fa-state.json");
let pending: Promise<string> | null = null;
/** A cookie that has passed the password step of twofa@example.com (valid 10 minutes). */
const pending2fa = (browser: Browser) => (pending ??= (async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, "twofa@example.com");
  await page.waitForURL("/login/2fa");
  await ctx.storageState({ path: PENDING_2FA });
  await ctx.close();
  return PENDING_2FA;
})());

/** The theme follows the emulated color scheme (next-themes "system"), then axe runs on the settled page. */
async function check(page: Page, dark: boolean) {
  await expect(page.locator("html")).toHaveClass(dark ? /\bdark\b/ : /^(?!.*\bdark\b)/);
  expect(await axeSerious(page)).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  const dark = colorScheme === "dark";
  test.describe(`${colorScheme}`, () => {
    test.use({ colorScheme });

    test("/login", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
      await check(page, dark);
    });

    test("/login/2fa", async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme, storageState: await pending2fa(browser) });
      const page = await ctx.newPage();
      await page.goto("/login/2fa");
      await expect(page.getByRole("heading", { level: 1, name: "Two-factor authentication" })).toBeVisible();
      await check(page, dark);
      await ctx.close();
    });

    test.describe("signed in", () => {
      test.use({ storageState: AUTH_STATE });
      for (const p of SIGNED_IN) {
        test(p, async ({ page }) => {
          await page.goto(p);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await page.waitForLoadState("networkidle");
          await check(page, dark);
        });
      }
    });
  });
}
