import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { axeSerious } from "./helpers";

/**
 * The /ds gallery, light and dark: screenshot baselines (in ds.spec.ts-snapshots/, made with `--update-snapshots`
 * and reviewed by eye), axe, and no horizontal scroll at the 1280 px minimum. Deterministic: the gallery's
 * fixtures carry fixed times, reduced motion and `animations: "disabled"` stop every animation, and every lazy chart
 * is mounted before the shot.
 */
test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

/** Scrolls through the page so every LazyMount region mounts (otherwise the height depends on the scroll position). */
async function mountAll(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
    window.scrollTo(0, 0);
  });
  // Everything has loaded; the "Loading sample" table is busy on purpose (it shows the loading state).
  await expect(page.locator('[aria-busy="true"]:not([aria-label="Loading sample"])')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test(`gallery screenshot matches the ${colorScheme} baseline`, async ({ page }) => {
      await page.goto("/ds");
      await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
      await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      await mountAll(page);
      await page.mouse.move(1, 1);
      // The gallery itself, not the shell around it (the account row differs per signed-in user).
      await expect(page.locator("#content > div").first()).toHaveScreenshot(`ds-${colorScheme}.png`, { animations: "disabled", maxDiffPixelRatio: 0.002 });
    });

    test("gallery: no serious axe violations", async ({ page }) => {
      await page.goto("/ds");
      await mountAll(page);
      expect(await axeSerious(page)).toEqual([]);
    });
  });
}

test("no horizontal scroll at the 1280 px desktop minimum", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ds");
  await mountAll(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
