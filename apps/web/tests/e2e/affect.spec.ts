import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { expectNoHorizontalScroll } from "./helpers";

/**
 * The vendored affectUI items (packages/ui/src/affect): each group closes one design system page
 * (features/ds/pages.ts `AFFECT_PAGE`). Items per group as the gallery's demo files list them.
 */
test.use({ storageState: AUTH_STATE });
const GROUPS = [
  { id: "actions", path: "/ds/components", title: "Components", count: 11 },
  { id: "inputs", path: "/ds/forms", title: "Forms", count: 14 },
  { id: "feedback", path: "/ds/feedback", title: "Feedback", count: 11 },
  { id: "content", path: "/ds/data", title: "Data display", count: 15 },
  { id: "visuals", path: "/ds/visuals", title: "Illustrations", count: 22 },
] as const;

test("every vendored item renders with content, without a page or console error", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const { id, path, title, count } of GROUPS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator("[data-affect-group]")).toHaveCount(1);
    const group = page.locator(`[data-affect-group="${id}"]`);
    await group.scrollIntoViewIfNeeded();
    await expect(group.locator("[data-affect]")).toHaveCount(count);
    // Each card's stage holds something with a size: an item that rendered nothing would leave it at its padding.
    const empty = await page.locator("[data-affect]").evaluateAll(cards => cards
      .filter(card => { const stage = card.lastElementChild?.firstElementChild; return !stage || stage.getBoundingClientRect().height < 1; })
      .map(card => card.getAttribute("data-affect")));
    expect(empty, path).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("the removed /ds/affect page is a 404", async ({ page }) => {
  expect((await page.goto("/ds/affect"))?.status()).toBe(404);
});

test("no horizontal page scroll at 1440, 834, 390 and 360 px", async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [1440, 834, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const { id, path } of GROUPS) {
      await page.goto(path);
      const group = page.locator(`[data-affect-group="${id}"]`);
      await group.scrollIntoViewIfNeeded();
      await expect(group.locator("[data-affect]").first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  }
});
