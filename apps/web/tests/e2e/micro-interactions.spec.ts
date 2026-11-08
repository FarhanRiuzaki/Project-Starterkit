import { expect, test, type Page } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll, smallTouchTargets } from "./helpers";

test.use({ storageState: AUTH_STATE });
async function preview(page: Page, parentReduced = false) {
  await page.goto("/ds");
  if (parentReduced) await page.getByRole("radiogroup", { name: "Preview reduced motion", exact: true }).getByRole("radio", { name: "Reduced", exact: true }).click();
  await page.getByRole("button", { name: "Explore micro-interactions" }).click();
  const dialog = page.getByRole("dialog", { name: "Micro-interactions", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("card hover and skeleton shimmer are shared foundations with reduced-motion fallbacks", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const dialog = await preview(page);
  const card = dialog.getByRole("button", { name: "Open sample card", exact: true });
  await card.hover();
  await expect.poll(() => card.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(0);
  await dialog.getByRole("heading", { name: "Cards and loading", exact: true }).hover();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByText("Card opened 1 time.", { exact: true })).toBeVisible();
  const shimmer = dialog.locator('[data-slot="skeleton-example"] [data-slot="skeleton"]').first();
  await dialog.getByRole("heading", { name: "Cards and loading", exact: true }).locator("../..").screenshot({ path: info.outputPath("card-and-skeleton-foundation.png"), animations: "disabled" });
  expect(await shimmer.evaluate(el => getComputedStyle(el, "::after").animationName)).toBe("shimmer");
  const disabled = dialog.getByRole("button", { name: "Unavailable sample card", exact: true });
  await expect(disabled).toBeDisabled();
  expect(await disabled.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await dialog.getByRole("radiogroup", { name: "Micro-interaction reduced motion" }).getByRole("radio", { name: "Reduced", exact: true }).click();
  await card.hover();
  expect(await card.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  expect(await shimmer.evaluate(el => getComputedStyle(el, "::after").display)).toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await dialog.getByRole("radiogroup", { name: "Micro-interaction reduced motion" }).getByRole("radio", { name: "System motion", exact: true }).click();
  await card.hover();
  expect(await card.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  expect(await shimmer.evaluate(el => getComputedStyle(el, "::after").display)).toBe("none");
});

test("press, hover, validation and async results work on the actual shared components", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const dialog = await preview(page);
  const save = dialog.getByRole("button", { name: /^Sav/ });
  await save.hover();
  await page.mouse.down();
  await expect.poll(() => save.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(1);
  await page.mouse.up();
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(dialog.getByRole("button", { name: "Saved", exact: true })).toBeEnabled();
  await expect(dialog.getByText("Example saved.", { exact: true })).toBeVisible();
  const disabled = dialog.getByRole("button", { name: "Unavailable", exact: true });
  const disabledBox = (await disabled.boundingBox())!;
  await page.mouse.move(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2); await page.mouse.down();
  expect(await disabled.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await page.mouse.up();
  const field = dialog.getByLabel("Project name", { exact: true });
  await dialog.getByRole("heading", { name: "Fields and validation", exact: true }).hover();
  const initial = await field.evaluate(el => getComputedStyle(el).borderColor);
  await field.hover();
  await expect.poll(() => field.evaluate(el => getComputedStyle(el).borderColor)).not.toBe(initial);
  await field.fill("A draft stays here");
  const input = await field.elementHandle();
  await dialog.getByRole("button", { name: "Show validation" }).click();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue("A draft stays here");
  expect(await field.evaluate((el, original) => el === original, input)).toBe(true);
  await field.hover();
  await expect.poll(() => field.evaluate(el => {
    const probe = document.createElement("span"); probe.style.borderColor = "var(--down-mark)"; el.parentElement!.append(probe);
    const matches = getComputedStyle(el).borderColor === getComputedStyle(probe).borderColor; probe.remove(); return matches;
  })).toBe(true);
  await field.focus(); await expect(field).toBeFocused();
  expect(await field.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");
});

test("selection, keyboard editing, step completion and progress keep stable controls", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const dialog = await preview(page);
  await page.screenshot({ path: testInfo.outputPath("micro-preview-desktop.png") });
  const checkbox = dialog.getByRole("checkbox", { name: "Include archived items" });
  await checkbox.focus(); await page.keyboard.press("Space");
  await expect(checkbox).toHaveAttribute("aria-checked", "true");
  await expect(checkbox).toBeFocused();
  expect(await checkbox.locator("svg").evaluate(el => getComputedStyle(el).animationName)).toBe("swap");
  const fixed = dialog.getByRole("checkbox", { name: "Managed setting" });
  await fixed.focus(); await page.keyboard.press("Space");
  await expect(fixed).toHaveAttribute("aria-checked", "true");
  await expect(fixed).toHaveAttribute("aria-readonly", "true");
  const radio = dialog.getByRole("radio", { name: "Email", exact: true });
  await radio.focus(); await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("radio", { name: "In-app", exact: true })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "In-app", exact: true })).toBeFocused();
  const toggle = dialog.getByRole("switch", { name: "Notifications" });
  await toggle.focus(); await page.keyboard.press("Space"); await expect(toggle).toBeChecked();
  const number = dialog.getByRole("spinbutton", { name: "Seats" });
  await number.fill("24"); await dialog.getByRole("button", { name: "Increase Seats" }).click();
  await expect(number).toHaveValue("25");
  const fill = dialog.locator('[data-slot="meter-fill"]');
  const stripeScale = await fill.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a * new DOMMatrix(getComputedStyle(el.firstElementChild!).transform).a);
  expect(stripeScale).toBeCloseTo(1);
  const slider = dialog.getByRole("slider", { name: "Sample progress" });
  await slider.focus(); await page.keyboard.press("End");
  await expect(dialog.getByRole("progressbar", { name: "Import progress" })).toHaveAttribute("aria-valuenow", "100");
  await expect.poll(() => fill.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBe(1);
  expect((await fill.evaluate(el => getComputedStyle(el).transitionProperty)).split(", ").every(p => ["transform", "translate", "scale", "rotate"].includes(p))).toBe(true);
  await dialog.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(dialog.locator('[data-slot="step-marker"][data-status="done"] svg')).toHaveCount(1);
  await expect(dialog.getByText("Members: step 2 of 3", { exact: true })).toBeVisible();
  const accordion = dialog.getByRole("button", { name: "Import details" });
  await accordion.click(); await expect(accordion).toHaveAttribute("aria-expanded", "true");
  await accordion.click(); await expect(accordion).toBeFocused();
  expect(await axeSerious(page)).toEqual([]);
});

test("reduced motion suppresses press and selection scale in the system and inline preview", async ({ page }) => {
  for (const source of ["system", "preview", "parent-preview"] as const) {
    await page.emulateMedia({ reducedMotion: source === "system" ? "reduce" : "no-preference" });
    const dialog = await preview(page, source === "parent-preview");
    if (source === "preview") await dialog.getByRole("radiogroup", { name: "Micro-interaction reduced motion" }).getByRole("radio", { name: "Reduced", exact: true }).click();
    const button = dialog.getByRole("button", { name: "Save example", exact: true });
    await button.hover(); await page.mouse.down();
    expect(await button.evaluate(el => getComputedStyle(el).transform)).toBe("none");
    await page.mouse.up();
    const radio = dialog.getByRole("radio", { name: "In-app", exact: true });
    await radio.check();
    expect(await radio.locator("..").locator('[data-slot="radio-mark"] > span').last().evaluate(el => getComputedStyle(el).transform)).toBe("none");
    await dialog.getByRole("button", { name: "Next step", exact: true }).click();
    expect(await dialog.locator('[data-slot="step-marker"][data-status="done"] svg').evaluate(el => getComputedStyle(el).animationName)).toBe("fade-in");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Explore micro-interactions" })).toBeFocused();
  }
});

test("touch controls and the preview fit 360px without sticky hover or undersized targets", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  const dialog = await preview(page);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: testInfo.outputPath("micro-preview-touch.png") });
  expect(await smallTouchTargets(page)).toEqual([]);
  await dialog.getByRole("checkbox", { name: "Include archived items" }).tap();
  await expect(dialog.getByRole("checkbox", { name: "Include archived items" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("radio", { name: "In-app", exact: true }).check();
  await expect(dialog.getByRole("radio", { name: "In-app", exact: true })).toBeChecked();
  expect(await axeSerious(page)).toEqual([]);
  await context.close();
});


test("OTP focus follows the native caret through typing, editing and sanitization", async ({ page }) => {
  await page.goto("/ds");
  const input = page.getByLabel("Verification code", { exact: true });
  const root = input.locator("..");
  const activeCell = () => root.locator('[data-slot="otp-cell"]').evaluateAll(cells => cells.findIndex(cell => cell.getAttribute("data-current") === "true"));
  await input.fill("123456");
  await expect(input).toHaveValue("123456");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  await expect.poll(activeCell).toBe(4);
  await page.keyboard.press("Backspace");
  await expect(input).toHaveValue("12356");
  await expect.poll(activeCell).toBe(3);
  await expect(input).toBeFocused();
  await input.fill("12a345");
  await expect(input).toHaveValue("12345");
  await input.fill("");
  await expect.poll(activeCell).toBe(0);
});
