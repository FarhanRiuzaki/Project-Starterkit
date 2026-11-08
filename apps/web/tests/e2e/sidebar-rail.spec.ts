import { expect, test } from "@playwright/test";
import path from "node:path";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll } from "./helpers";

test.use({ storageState: AUTH_STATE });
const remembered = "/users?role=Viewer&status=active&status=inactive";
const isRemembered = (url: URL) => url.pathname === "/users" && url.searchParams.get("role") === "Viewer" && url.searchParams.getAll("status").sort().join() === "active,inactive";

test("Users is one direct destination in expanded/collapsed navigation, palette and G U, retaining its view", async ({ page }) => {
  await page.goto(remembered);
  const nav = page.getByRole("navigation", { name: "Menu", exact: true });
  const users = nav.getByRole("link", { name: "Users", exact: true });
  await expect(users).toHaveCount(1);
  await expect(users).toHaveAttribute("aria-current", "page");
  await expect(users).toHaveAttribute("href", /role=Viewer/);
  await expect(nav.getByRole("link", { name: /^(All|Active|Inactive) users$/ })).toHaveCount(0);
  await nav.getByRole("link", { name: "Roles", exact: true }).click();
  await users.click();
  await expect(page).toHaveURL(isRemembered);
  await page.goBack();
  await expect(page).toHaveURL(/\/roles/);
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("g"); await page.keyboard.press("u");
  await expect(page).toHaveURL(isRemembered);
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  const roles = nav.getByRole("link", { name: "Roles", exact: true });
  await roles.hover();
  await expect(page.getByRole("tooltip", { name: "Roles", exact: true })).toHaveAttribute("data-side", "right");
  await page.keyboard.press("Escape");
  await roles.click();
  await users.focus();
  await expect(page.getByRole("tooltip", { name: "Users", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(isRemembered);
  await expect(page.getByRole("menu", { name: "Users", exact: true })).toHaveCount(0);
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search pages", exact: true });
  await expect(palette.getByRole("option", { name: /^Users/ })).toHaveCount(1);
  await expect(palette.getByRole("option", { name: /^(All|Active|Inactive) users/ })).toHaveCount(0);
  await palette.getByRole("option", { name: /^Users/ }).click();
  await expect(page).toHaveURL(isRemembered);
  await page.screenshot({ path: path.join(SCRATCH, "batch-a-nav-collapsed.png"), animations: "disabled" });
  expect(await axeSerious(page)).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
});

for (const width of [834, 390]) test(`${width}: touch navigation has one Users destination and closes after remembered navigation`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width, height: width === 390 ? 844 : 1112 }, hasTouch: true, isMobile: width === 390 });
  try {
    const page = await context.newPage();
    await page.goto(remembered);
    // Wait for URL state to be reflected in the single source of remembered preferences.
    if (width === 834) await expect(page.getByRole("navigation", { name: "Menu", exact: true }).getByRole("link", { name: "Users", exact: true })).toHaveAttribute("href", /role=Viewer/);
    await page.getByRole("button", { name: "Open navigation", exact: true }).tap();
    const drawer = page.locator('[data-slot="drawer-content"]');
    const users = drawer.getByRole("link", { name: "Users", exact: true });
    await expect(users).toHaveCount(1);
    await expect(users).toHaveAttribute("aria-current", "page");
    await expect(users).toHaveAttribute("href", /role=Viewer/);
    await expect(drawer.getByRole("link", { name: /^(All|Active|Inactive) users$/ })).toHaveCount(0);
    await page.screenshot({ path: path.join(SCRATCH, `batch-a-nav-drawer-${width}.png`), animations: "disabled" });
    await drawer.getByRole("link", { name: "Roles", exact: true }).tap();
    await expect(drawer).toHaveCount(0);
    await page.getByRole("button", { name: "Open navigation", exact: true }).tap();
    await users.tap();
    await expect(page).toHaveURL(isRemembered);
    await expect(drawer).toHaveCount(0);
    for (const status of ["inactive", "active"]) {
      await page.goto(`/users?status=${status}`);
      await expect(page.getByRole("heading", { name: status === "active" ? "Active users" : "Inactive users", exact: true })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
  } finally { await context.close(); }
});
