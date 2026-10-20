import { expect, type Page, test } from "@playwright/test";
import { BRAND } from "../../../../packages/shared/src/brand";
import { NAV } from "../../src/lib/shared/nav";
import { AUTH_STATE } from "./global-setup";
import { expectNoHorizontalScroll, pending2faState, settleAnimations, smallTouchTargets, withIds } from "./helpers";

/**
 * Responsive (design-system §0), on the desktop, tablet and mobile projects (playwright.config.ts): no page scrolls
 * sideways (mobile: at 390 and at 360 px), the shell per width class, and on the phone the navigation drawer, the
 * bottom sheet, the header's More menu, 44 px touch targets and no layout shift on first paint.
 */

/** Every page: the nav pages, the sub-pages, the sign-in pages (`{name}` = a demo id, helpers.ts demoIds). */
const SIGNED_IN = [...NAV.map((n) => n.href), "/users/new", "/users/{admin}", "/users/{admin}/edit", "/roles/{superadminRole}", "/me/security", "/me/sessions"];
const SIGNED_OUT = ["/login", "/forgot-password", "/reset-password"];

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** At the project's width; a phone also at 360 px, the narrowest supported. */
async function checkWidths(page: Page, isMobile: boolean) {
  await expectNoHorizontalScroll(page);
  if (!isMobile) return;
  await page.setViewportSize({ width: 360, height: 740 });
  await expectNoHorizontalScroll(page);
}

test.describe("no horizontal page scroll", () => {
  test.describe("signed in", () => {
    test.use({ storageState: AUTH_STATE });
    for (const p of SIGNED_IN) {
      test(p, async ({ page, baseURL, isMobile }) => {
        await open(page, await withIds(p, baseURL));
        await checkWidths(page, isMobile);
      });
    }
  });
  for (const p of SIGNED_OUT) {
    test(p, async ({ page, isMobile }) => {
      await open(page, p);
      await checkWidths(page, isMobile);
    });
  }
  test("/login/2fa", async ({ browser, isMobile }) => {
    const ctx = await browser.newContext({ storageState: await pending2faState(browser) });
    const page = await ctx.newPage();
    await open(page, "/login/2fa");
    await checkWidths(page, isMobile);
    await ctx.close();
  });
});

test.describe("shell from 768 px", () => {
  test.skip(({ isMobile }) => isMobile, "tablet and desktop");
  test.use({ storageState: AUTH_STATE });

  test("the sidebar stays (the 64 px rail on a tablet), no menu button", async ({ page }, info) => {
    await open(page, "/");
    const aside = page.getByRole("complementary", { name: "Main navigation" });
    await expect(aside).toBeVisible();
    const w = (await aside.boundingBox())!.width;
    if (info.project.name === "tablet") expect(w).toBe(64);
    else expect([64, 248]).toContain(w);
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");
  test.use({ storageState: AUTH_STATE });

  const menuButton = (page: Page) => page.getByRole("button", { name: "Open navigation" });
  const drawer = (page: Page) => page.getByRole("dialog", { name: "Navigation" });

  test("the top bar: menu button, logo, page title, search and account; no sidebar", async ({ page }) => {
    await open(page, "/users");
    await expect(page.getByRole("complementary", { name: "Main navigation" })).toBeHidden();
    await expect(menuButton(page)).toBeVisible();
    await expect(page.getByRole("img", { name: BRAND.name }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Users");
    await expect(page.getByRole("button", { name: "Search pages" })).toBeVisible();
    await expect(page.getByRole("button", { name: /account menu/ })).toBeVisible();
  });

  test("the drawer opens from the menu button and reaches every nav item", async ({ page }) => {
    await open(page, "/");
    for (const n of NAV) {
      await menuButton(page).click();
      await expect(drawer(page)).toBeVisible();
      await drawer(page).getByRole("link", { name: n.label }).click();
      await expect(page).toHaveURL((u) => u.pathname === n.href);
      await expect(drawer(page)).toBeHidden();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("focus moves into the drawer, the page behind is inert; Escape closes it and focus returns", async ({ page }) => {
    await open(page, "/users");
    await menuButton(page).click();
    await expect(drawer(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    expect(await page.locator("#content").evaluate((el) => !!el.closest("[inert]")), "page behind is inert").toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    expect(await page.locator("[inert]").count()).toBe(0);
  });

  test("a route change closes the drawer (Back) and focus returns to the menu button", async ({ page }) => {
    await open(page, "/");
    await menuButton(page).click();
    await drawer(page).getByRole("link", { name: "Roles" }).click();
    await expect(page).toHaveURL(/\/roles$/);
    await menuButton(page).click();
    await expect(drawer(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL((u) => u.pathname === "/");
    await expect(drawer(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });

  test("a tap on the scrim closes the drawer", async ({ page }) => {
    await open(page, "/");
    await menuButton(page).click();
    await expect(drawer(page)).toBeVisible();
    const vw = page.viewportSize()!.width;
    await page.touchscreen.tap(vw - 16, 400);
    await expect(drawer(page)).toBeHidden();
  });

  test("a dialog is a bottom sheet: full width, on the bottom edge, at most 90 % high, actions in view", async ({ page }) => {
    await open(page, "/roles");
    await page.getByRole("button", { name: "Create role" }).click();
    const sheet = page.getByRole("dialog", { name: "Create role" });
    await expect(sheet).toBeVisible();
    await settleAnimations(page);
    const box = (await sheet.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(vp.width, 0);
    expect(box.y + box.height).toBeCloseTo(vp.height, 0);
    expect(box.height).toBeLessThanOrEqual(vp.height * 0.9 + 1);
    await expect(sheet.getByRole("button", { name: "Create role" })).toBeInViewport();
  });

  test("the page header keeps its primary action and folds the others into More actions", async ({ page, baseURL }) => {
    await open(page, await withIds("/users/{admin}", baseURL));
    await expect(page.getByRole("link", { name: "Edit user" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset password" })).toBeHidden();
    await page.getByRole("button", { name: "More actions" }).click();
    for (const name of ["Reset password", "Deactivate user", "Delete user"]) await expect(page.getByRole("menuitem", { name })).toBeVisible();
  });

  test("touch targets of visible controls are at least 44 × 44 px on every page", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const small: string[] = [];
    for (const p of SIGNED_IN) {
      await open(page, await withIds(p, baseURL));
      small.push(...(await smallTouchTargets(page)).map((s) => `${p}: ${s}`));
    }
    expect(small).toEqual([]);
  });

  test("the phone shell renders filled on first paint without layout shift", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    for (const p of ["/", "/users"]) {
      await open(page, p);
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), `${p} layout shift`).toBeLessThan(0.01);
    }
  });
});
