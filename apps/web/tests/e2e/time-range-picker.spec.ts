import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll, settleAnimations } from "./helpers";
import path from "node:path";
test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

test("quick select applies minutes, keeps real history and configures refresh", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /^Time range:/ });
  // Click the summary text well away from the calendar icon.
  await trigger.locator("span").last().click();
  const picker = page.getByRole("dialog", { name: "Quick select time range", exact: true });
  await expect.poll(() => page.locator('[data-slot="time-range-control"] [data-slot="disclosure-icon"]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(-1);
  await expect(picker.getByRole("button", { name: "Last 15 minutes", exact: true })).toBeVisible();
  await picker.getByRole("spinbutton", { name: "Quick range amount" }).fill("15");
  const response = page.waitForResponse(r => r.url().includes("/api/dashboard?start=") && r.status() === 200);
  await picker.getByRole("button", { name: "Apply", exact: true }).click();
  const body = await (await response).json();
  expect(Date.parse(body.period.end) - Date.parse(body.period.start)).toBe(900000);
  await expect(trigger).toHaveAccessibleName("Time range: Last 15 minutes");
  await trigger.click();
  await expect(picker.getByRole("region", { name: "Recently used time ranges" }).getByRole("button", { name: "Last 15 minutes", exact: true })).toBeVisible();
  await picker.getByRole("switch", { name: "Refresh every", exact: true }).check();
  await picker.getByRole("spinbutton", { name: "Refresh amount" }).fill("30");
  await expect(page).toHaveURL(/refresh=30/);
  await picker.getByRole("spinbutton", { name: "Refresh amount" }).fill("1");
  expect(new URL(page.url()).searchParams.get("refresh")).toBeNull();
  await expect(picker.getByText("Choose 5 seconds to 1 hour. Refresh is paused until valid.")).toBeVisible();
  await picker.getByRole("spinbutton", { name: "Refresh amount" }).fill("10");
  expect(await axeSerious(page)).toEqual([]);
  await settleAnimations(page);
  await page.screenshot({ path: path.join(SCRATCH, "time-picker-quick.png") });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("separate absolute, relative and now editors preserve drafts until apply", async ({ page }) => {
  await page.goto("/?start=now-15m&end=now");
  await page.getByRole("button", { name: "Show dates", exact: true }).click();
  const start = page.getByRole("button", { name: /^Edit start time:/ });
  await start.click();
  const editor = page.getByRole("dialog", { name: "Edit start time", exact: true });
  await editor.getByRole("tab", { name: "Absolute", exact: true }).click();
  await expect(editor.getByRole("grid")).toBeVisible();
  await editor.getByRole("button", { name: "Choose month", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "February", exact: true }).click();
  await editor.getByRole("button", { name: "Choose year", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "2025", exact: true }).click();
  await editor.getByRole("button", { name: "Friday, February 28, 2025", exact: true }).click();
  await expect(editor.getByLabel("Start date", { exact: true })).toHaveValue(/^2025-02-28 /);
  await expect(editor.getByRole("listbox", { name: "Start time of day" })).toBeVisible();
  await editor.getByRole("option", { name: "09:00", exact: true }).click();
  await expect(editor.getByLabel("Start date", { exact: true })).toHaveValue(/09:00:00.000$/);
  await settleAnimations(page);
  await page.screenshot({ path: path.join(SCRATCH, "time-picker-absolute.png") });
  await editor.getByRole("tab", { name: "Relative", exact: true }).click();
  await editor.getByRole("spinbutton", { name: "Start relative amount" }).fill("30");
  await editor.getByRole("switch", { name: "Round start time" }).check();
  await settleAnimations(page);
  await page.screenshot({ path: path.join(SCRATCH, "time-picker-relative.png") });
  expect(await axeSerious(page)).toEqual([]);
  await editor.getByRole("button", { name: "Set start time", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("start")).toBe("now-15m");
  await expect(page.getByRole("button", { name: "Apply time range", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: /^Edit end time:/ }).click();
  const end = page.getByRole("dialog", { name: "Edit end time", exact: true });
  await expect(end.getByRole("tab", { name: "Now", exact: true })).toHaveAttribute("data-state", "active");
  await settleAnimations(page);
  await page.screenshot({ path: path.join(SCRATCH, "time-picker-now.png") });
  await end.getByRole("button", { name: "Set end time to now", exact: true }).click();
  await page.getByRole("button", { name: "Apply time range", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("start")).toBe("now-30m/m");
  await page.goBack();
  await expect(page.getByRole("button", { name: /^Time range:/ })).toHaveAccessibleName("Time range: Last 15 minutes");
  await page.getByRole("button", { name: /^Edit start time:/ }).click();
  const invalid = page.getByRole("dialog", { name: "Edit start time", exact: true });
  await invalid.getByRole("tab", { name: "Now", exact: true }).click();
  await invalid.getByRole("button", { name: "Set start time to now", exact: true }).click();
  await expect(page.getByRole("button", { name: "Apply time range", exact: true })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "End time must follow start time" })).toBeVisible();

});

test("time editors stay usable on touch phones in light and dark", async ({ browser, baseURL }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/?start=now-15m&end=now");
    await page.getByRole("button", { name: /^Time range:/ }).click();
    const picker = page.getByRole("dialog", { name: "Quick select time range", exact: true });
    await expectNoHorizontalScroll(page);
    await picker.getByRole("button", { name: "Last 1 year", exact: true }).click();
    await page.getByRole("button", { name: "Show dates", exact: true }).click();
    await page.getByRole("button", { name: /^Edit start time:/ }).click();
    const editor = page.getByRole("dialog", { name: "Edit start time", exact: true });
    await editor.getByRole("tab", { name: "Absolute", exact: true }).click();
    await expectNoHorizontalScroll(page);
    await settleAnimations(page);
    expect(await axeSerious(page)).toEqual([]);
    await settleAnimations(page);
  await page.screenshot({ path: path.join(SCRATCH, `time-picker-mobile-${colorScheme}.png`) });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Edit start time:/ })).toBeFocused();
    await context.close();
  }
});
