import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll, settleAnimations } from "./helpers";
test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

test("account belongs to sidebar, route tabs use grey, and time controls are module scoped", async ({ page }) => {
  await page.goto("/me");
  await expect(page.locator("[data-shell-header]").getByRole("button", { name: /account menu/ })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Main navigation" }).getByRole("button", { name: /account menu/ })).toBeVisible();
  await expect(page.getByLabel("Page time controls")).toHaveCount(0);
  const active = page.getByRole("navigation", { name: "Account", exact: true }).getByRole("link", { name: "Profile" });
  expect(await active.evaluate(el => { const probe = document.createElement("span"); probe.style.backgroundColor = "var(--tray)"; el.appendChild(probe); const matches = getComputedStyle(el).backgroundColor === getComputedStyle(probe).backgroundColor; probe.remove(); return matches; })).toBe(true);
  await page.goto("/users");
  await expect(page.getByRole("button", { name: /^Time range:/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh now", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Auto-refresh interval", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Every 30 seconds" }).click();
  await expect(page).toHaveURL(/refresh=30/);
  expect(await page.locator(".nav-tree-branch").first().evaluate(el => getComputedStyle(el).borderBottomLeftRadius)).not.toBe("0px");
  await page.goto("/users/new");
  await expect(page.getByLabel("Page time controls")).toHaveCount(0);
});

test("custom date picker supports typed dates, keyboard navigation, month clamping and focus return", async ({ page }) => {
  await page.goto("/ds");
  await page.locator("#library-date").fill("2024-01-31");
  await page.getByRole("button", { name: "Choose appointment date", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Choose appointment date", exact: true });
  const january = calendar.getByRole("button", { name: "Wednesday, January 31, 2024", exact: true });
  await expect(january).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect(calendar.getByRole("button", { name: "Thursday, February 29, 2024", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#library-date")).toHaveValue("2024-02-29");
  await expect(page.getByRole("button", { name: "Choose appointment date", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Choose appointment date", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveCount(0);
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
});

test("clicking the date field opens its calendar; month and year are directly selectable", async ({ page }) => {
  await page.goto("/ds");
  const input = page.locator("#library-date");
  await input.fill("2024-01-31");
  await input.click({ position: { x: 12, y: 16 } });
  const calendar = page.getByRole("dialog", { name: "Choose appointment date", exact: true });
  await expect(calendar).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await calendar.getByRole("button", { name: "Choose month", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "February", exact: true }).click();
  await calendar.getByRole("button", { name: "Choose year", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "2024", exact: true })).toBeInViewport();
  await page.getByRole("menuitemradio", { name: "2025", exact: true }).click();
  await expect(calendar.getByRole("grid", { name: "February 2025", exact: true })).toBeVisible();
  await expect(input).toHaveValue("2024-01-31");
  await calendar.getByRole("button", { name: "Friday, February 28, 2025", exact: true }).click();
  await expect(input).toHaveValue("2025-02-28");
  await expect(input).toBeFocused();
  await input.click({ position: { x: 120, y: 16 } });
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toBeFocused();
  await input.press("Alt+ArrowDown");
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toBeFocused();
});

test("date fields and month/year menus work on touch phones in both themes", async ({ browser, baseURL }, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/ds");
    const input = page.locator("#library-date");
    await input.fill("2024-01-31");
    await input.tap({ position: { x: 12, y: 20 } });
    const calendar = page.getByRole("dialog", { name: "Choose appointment date", exact: true });
    await expect(calendar).toBeVisible();
    await calendar.getByRole("button", { name: "Choose month", exact: true }).tap();
    await page.getByRole("menuitemradio", { name: "February", exact: true }).tap();
    await calendar.getByRole("button", { name: "Choose year", exact: true }).tap();
    await expect(page.getByRole("menuitemradio", { name: "2024", exact: true })).toBeInViewport();
    await page.getByRole("menuitemradio", { name: "2025", exact: true }).tap();
    await expectNoHorizontalScroll(page);
    await settleAnimations(page);
    expect(await axeSerious(page)).toEqual([]);
    await calendar.screenshot({ path: info.outputPath(`calendar-phone-${colorScheme}.png`) });
    await calendar.getByRole("button", { name: "Friday, February 28, 2025", exact: true }).tap();
    await expect(input).toHaveValue("2025-02-28");
    await expect(input).toBeFocused();
    await context.close();
  }
});

test("catalog finds Figma components and all new examples fit phone and desktop", async ({ page }) => {
  await page.goto("/ds");
  await page.getByLabel("Find a component").fill("Calendar");
  const mappings = page.getByLabel("Component mappings");
  await expect(mappings.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await mappings.getByRole("article").filter({ has: page.getByRole("heading", { name: "Calendar", exact: true }) }).getByRole("link", { name: "Example", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Calendar and date picker", exact: true })).toBeInViewport();
  await page.getByLabel("Find a component").fill("");
  for (const width of [1440, 390, 360]) { await page.setViewportSize({ width, height: 900 }); await expectNoHorizontalScroll(page); }
  expect(await axeSerious(page)).toEqual([]);
});

test("header time controls share one height and baseline with search", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await settleAnimations(page);
  const header = page.locator("[data-shell-header]");
  const boxes = await Promise.all([
    header.getByRole("button", { name: "Previous time range" }),
    header.locator('[data-slot="time-range-input"]'),
    header.getByRole("button", { name: "Next time range" }),
    header.getByRole("button", { name: "Refresh now", exact: true }),
    header.getByRole("button", { name: "Search pages", exact: true }),
  ].map(locator => locator.boundingBox()));
  expect(boxes.map(box => box?.height)).toEqual([32, 32, 32, 32, 32]);
  expect(new Set(boxes.map(box => box?.y)).size).toBe(1);
});
