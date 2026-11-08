import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import path from "node:path";
import { PALETTES } from "../../src/lib/shared/palette";
import { axeSerious, expectNoHorizontalScroll, settleAnimations } from "./helpers";

test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

test("navbar range commits to dashboard data, supports custom dates and keeps one export on audit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Time range: Last 14 days" }).click();
  const response = page.waitForResponse(r => r.url().includes("/api/dashboard?start=") && r.status() === 200);
  await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
  const body = await (await response).json();
  expect(Date.parse(body.period.end) - Date.parse(body.period.start)).toBe(7 * 86400000);
  expect(new URL(page.url()).searchParams.get("start")).toBe("now-7d");
  await page.getByRole("button", { name: "Show dates", exact: true }).click();
  await page.getByRole("button", { name: /^Edit start time:/ }).click();
  await page.getByRole("tab", { name: "Absolute", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-01 00:00:00.000");
  await page.getByRole("button", { name: "Set start time", exact: true }).click();
  await page.getByRole("button", { name: /^Edit end time:/ }).click();
  await page.getByRole("tab", { name: "Absolute", exact: true }).click();
  await page.getByLabel("End date", { exact: true }).fill("2026-11-04 00:00:00.000");
  await page.getByRole("button", { name: "Set end time", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("start")).toBe("now-7d");
  await page.getByRole("button", { name: "Apply time range", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("start")).toBe("2026-10-31T17:00:00.000Z");
  await page.goto("/audit/auth?event=login_failed&refresh=30");
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Time range: Last 7 days" }).click();
  await page.getByRole("button", { name: "Last 30 days", exact: true }).click();
  await expect(page).toHaveURL(/event=login_failed/); await expect(page).toHaveURL(/refresh=30/);
  await page.screenshot({ path: path.join(SCRATCH, "implemented-audit.png"), fullPage: true });
});

test("manual and automatic refresh use real data; form routes hide controls", async ({ page }) => {
  await page.goto("/?refresh=10");
  const refreshed = page.waitForResponse((r) => r.url().endsWith("/api/dashboard") && r.status() === 200);
  await page.getByRole("button", { name: "Refresh now", exact: true }).click();
  await refreshed;
  const automatic = page.waitForResponse((r) => r.url().endsWith("/api/dashboard") && r.status() === 200);
  await automatic;
  await page.goto("/users/new?refresh=10");
  await expect(page.getByRole("button", { name: "Refresh now", exact: true })).toHaveCount(0);
});

test("palettes persist independently of theme and retain responsive layouts", async ({ page }) => {
  await page.goto("/");
  for (const { value, label } of [...PALETTES.slice(1), PALETTES[0]]) {
    await page.getByRole("button", { name: /account menu$/ }).click();
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-palette", value!);
  }
  await page.reload(); await page.waitForLoadState("networkidle"); await expect(page.locator("html")).toHaveAttribute("data-palette", "current");
  for (const width of [1440, 834, 390, 360]) {
    await page.setViewportSize({ width, height: 960 });
    await expectNoHorizontalScroll(page);
    await settleAnimations(page);
    await page.screenshot({ animations: "disabled", path: path.join(SCRATCH, `implemented-home-${width}.png`), fullPage: true });
  }
});

test("form pack supports keyboard search, paste, boundary controls and wizard validation", async ({ page }) => {
  await page.goto("/ds");
  const wizard = page.locator("#ds-forms");
  await page.locator("#affix-prefix").scrollIntoViewIfNeeded();
  const inputTops = await page.locator("#affix-prefix, #affix-suffix, #affix-both").evaluateAll((inputs) => inputs.map((input) => input.getBoundingClientRect().top));
  expect(Math.max(...inputTops) - Math.min(...inputTops), "helper text must not shift neighboring inputs").toBeLessThan(1);
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(wizard.getByLabel("Team name", { exact: true })).toBeFocused();
  await wizard.getByLabel("Team name", { exact: true }).fill("Operations");
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard.getByRole("spinbutton", { name: "team seats", exact: true }).fill("100");
  await expect(wizard.getByRole("button", { name: "Increase team seats", exact: true })).toBeDisabled();
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(wizard.getByRole("heading", { name: "Review your choices" })).toBeFocused();
  await wizard.getByRole("button", { name: "Finish example", exact: true }).click();
  await expect(wizard.getByRole("heading", { name: "Example complete", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Team members: Choose" }).click();
  await page.getByRole("combobox", { name: "Team members", exact: true }).fill("Priya");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Team members: Priya Shah" })).toBeVisible();
  await page.locator("#sample-otp").fill("123456"); await expect(page.locator("#sample-otp")).toHaveValue("123456");
  expect(await axeSerious(page)).toEqual([]);
});


test("approved login artwork stays behind the form in both modes and at narrow widths", async ({ browser, baseURL }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ baseURL, colorScheme, reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 }); await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page);
      const art = page.locator(".auth-landscape");
      await expect(art).toBeVisible();
      await expect(art).toHaveCSS("background-image", new RegExp(`/illustrations/auth-landscape${colorScheme === "dark" ? "-dark" : ""}\\.svg`));
      await expect(art).toHaveCSS("background-size", "cover");
      await expect(art).toHaveAttribute("aria-hidden", "true");
      expect(await art.evaluate(el => { const box = el.getBoundingClientRect(); return [box.x, box.y, box.width, box.height]; })).toEqual([0, 0, width, await page.locator("main").evaluate(el => el.getBoundingClientRect().height)]);
      await page.screenshot({ path: path.join(SCRATCH, `implemented-login-${colorScheme}-${width}.png`), animations: "disabled", fullPage: true });
      expect(await axeSerious(page)).toEqual([]);
    }
    await ctx.close();
  }
});
