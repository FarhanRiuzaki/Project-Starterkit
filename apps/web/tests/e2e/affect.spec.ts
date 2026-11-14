import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { expectNoHorizontalScroll } from "./helpers";

/** /ds/affect: the vendored affectUI items (packages/ui/src/affect). Items per group as the gallery's demo files list them. */
test.use({ storageState: AUTH_STATE });
const GROUPS = { actions: 11, inputs: 14, feedback: 11, content: 15, visuals: 22 } as const;

test("every vendored item renders with content, without a page or console error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/ds/affect");
  await expect(page.getByRole("heading", { level: 1, name: "affectUI components", exact: true })).toBeVisible();
  for (const [id, count] of Object.entries(GROUPS)) {
    const group = page.locator(`[data-affect-group="${id}"]`);
    await group.scrollIntoViewIfNeeded();
    await expect(group.locator("[data-affect]")).toHaveCount(count);
  }
  // Each card's stage holds something with a size: an item that rendered nothing would leave it at its padding.
  const empty = await page.locator("[data-affect]").evaluateAll(cards => cards
    .filter(card => { const stage = card.lastElementChild?.firstElementChild; return !stage || stage.getBoundingClientRect().height < 1; })
    .map(card => card.getAttribute("data-affect")));
  expect(empty).toEqual([]);
  expect(errors).toEqual([]);
});

test("no horizontal page scroll at 1440, 834 and 390 px", async ({ page }) => {
  for (const width of [1440, 834, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ds/affect");
    for (const id of Object.keys(GROUPS)) {
      const group = page.locator(`[data-affect-group="${id}"]`);
      await group.scrollIntoViewIfNeeded();
      await expect(group.locator("[data-affect]").first()).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
  }
});
