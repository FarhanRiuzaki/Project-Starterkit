import { expect, test } from "@playwright/test";
import path from "node:path";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll } from "./helpers";

test.use({ storageState: AUTH_STATE });

test("collapsed sidebar uses standard tooltips and a keyboard-accessible view menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Menu", exact: true });
  const roles = nav.getByRole("link", { name: "Roles", exact: true });
  await roles.hover();
  await expect(page.getByRole("tooltip", { name: "Roles", exact: true })).toBeVisible();
  await expect(page.getByRole("tooltip", { name: "Roles", exact: true })).toHaveAttribute("data-side", "right");
  await page.keyboard.press("Escape");
  await roles.focus();
  await expect(page.getByRole("tooltip", { name: "Roles", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const users = nav.getByRole("button", { name: "Users", exact: true });
  await users.focus();
  await expect(page.getByRole("tooltip", { name: "Users", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "Users", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "All users", exact: true })).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Active users", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/users\?status=active/);
  await expect(menu).toHaveCount(0);
  await users.click();
  await expect(menu.getByRole("menuitem", { name: "Active users", exact: true })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: path.join(SCRATCH, "sidebar-rail-views.png"), animations: "disabled" });
  expect(await axeSerious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(users).toBeFocused();
  // Wait beyond the standard tooltip delay: returning focus must not reopen it over the closed menu.
  await page.waitForTimeout(400);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await users.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(menu).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
});

test("tablet touch can select a view; expanding out of the rail closes its menu", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width: 834, height: 1112 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Menu", exact: true });
    const users = nav.getByRole("button", { name: "Users", exact: true });
    await users.tap();
    const menu = page.getByRole("menu", { name: "Users", exact: true });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Inactive users", exact: true }).tap();
    await expect(page).toHaveURL(/\/users\?status=inactive/);
    await expect(menu).toHaveCount(0);
    await users.tap();
    await expect(menu).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(menu).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Users", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Inactive users", exact: true })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  } finally { await context.close(); }
});
