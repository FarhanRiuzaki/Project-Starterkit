import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious } from "./helpers";

/**
 * The design system pages, light and dark: screenshot baselines (in ds.spec.ts-snapshots/, made with
 * `--update-snapshots` and reviewed by eye), axe, and no horizontal scroll at the 1280 px minimum. Deterministic: the
 * fixtures carry fixed times, reduced motion and `animations: "disabled"` stop every animation, and every lazy region
 * is mounted before the shot. The vendored affectUI group that closes a page (animated, upstream's own look) is masked
 * in the shot and skipped by axe (helpers.ts axeSerious); /ds/visuals holds nothing else, so it has no baseline.
 */
test.setTimeout(90_000);
test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

/** `id` names the baseline (`ds-<id>-<scheme>-<project>-<platform>.png`); `title` is the page's h1. */
const PAGES = [
  { id: "overview", path: "/ds", title: "Design system" },
  { id: "foundations", path: "/ds/foundations", title: "Foundations" },
  { id: "components", path: "/ds/components", title: "Components" },
  { id: "forms", path: "/ds/forms", title: "Forms" },
  { id: "feedback", path: "/ds/feedback", title: "Feedback" },
  { id: "data", path: "/ds/data", title: "Data display" },
  { id: "motion", path: "/ds/motion", title: "Motion" },
] as const;
const VISUALS = { id: "visuals", path: "/ds/visuals", title: "Illustrations" } as const;

/** Opens a page and scrolls through it so every LazyMount region mounts (otherwise the height depends on the scroll position). */
async function mountAll(page: Page, p: { path: string; title: string }) {
  await page.goto(p.path);
  await expect(page.getByRole("heading", { level: 1, name: p.title, exact: true })).toBeVisible();
  // The body arrives after hydration, in its own chunk.
  await expect(page.locator('[data-slot="body-loading"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
    window.scrollTo(0, 0);
  });
  // Everything has loaded; the "Loading sample" table is busy on purpose (it shows the loading state).
  await expect(page.locator('[aria-busy="true"]:not([aria-label="Loading sample"]):not([data-affect-group] *)')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    for (const p of PAGES) {
      test(`${p.path} screenshot matches the ${colorScheme} baseline`, async ({ page }, testInfo) => {
        await mountAll(page, p);
        await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
        await page.mouse.move(1, 1);
        // The page itself, not the shell around it (the account row differs per signed-in user).
        // CSS pixels (`scale: "css"`): the phone baseline (3× screen) stays the size of the page, as the desktop one.
        // The sticky top bar is hidden for the shot: it would be drawn over the page wherever the capture had scrolled to.
        const hideTopBar = await page.addStyleTag({ content: "[data-shell-header] { visibility: hidden !important; }" });
        await expect(page.locator("#content > div").first()).toHaveScreenshot(`ds-${p.id}-${colorScheme}.png`,
          { animations: "disabled", maxDiffPixelRatio: 0.002, scale: "css", mask: [page.locator("[data-affect-group]")] });
        await hideTopBar.evaluate((el) => (el as Element).remove());
        if (p.id !== "data") return;
        // A viewport capture keeps the changed filter example readable beside the very tall page baseline.
        await page.locator('[data-slot="filter-layout"]').first().evaluate(element => {
          const header = document.querySelector<HTMLElement>('[data-shell-header]');
          const offset = window.innerWidth < 768 ? (header?.offsetHeight ?? 0) + 16 : 48;
          window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - offset, behavior: "instant" });
        });
        await page.screenshot({ path: path.join(SCRATCH, `gallery-filter-${testInfo.project.name}-${colorScheme}.png`), animations: "disabled", scale: "css" });
      });

      test(`${p.path}: no serious axe violations`, async ({ page }) => {
        await mountAll(page, p);
        expect(await axeSerious(page)).toEqual([]);
      });
    }
  });
}

test("no horizontal scroll at the 1280 px desktop minimum", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop width");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const p of [...PAGES, VISUALS]) {
    await mountAll(page, p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), p.path).toBe(0);
  }
});
