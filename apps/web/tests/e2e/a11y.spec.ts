import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { axeSerious, pending2faState, withIds } from "./helpers";

/**
 * axe (WCAG 2.0–2.2 A/AA): no serious or critical violation on the sign-in steps and the main screens, light and
 * dark, on the desktop, tablet and mobile projects (playwright.config.ts). Signed-in pages use the superadmin session from
 * global-setup; /login/2fa needs a sign-in waiting for its second factor (helpers.ts pending2faState).
 */
/** `{name}` = a demo id (helpers.ts demoIds). */
const SIGNED_IN = ["/", "/users", "/users/{admin}", "/roles/{superadminRole}", "/permissions", "/audit/activity", "/audit/auth", "/me/security"];


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
      const ctx = await browser.newContext({ colorScheme, storageState: await pending2faState(browser) });
      const page = await ctx.newPage();
      await page.goto("/login/2fa");
      await expect(page.getByRole("heading", { level: 1, name: "Two-factor authentication" })).toBeVisible();
      await check(page, dark);
      await ctx.close();
    });

    test.describe("signed in", () => {
      test.use({ storageState: AUTH_STATE });
      for (const p of SIGNED_IN) {
        test(p, async ({ page, baseURL }) => {
          await page.goto(await withIds(p, baseURL));
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await page.waitForLoadState("networkidle");
          await check(page, dark);
        });
      }
    });
  });
}
