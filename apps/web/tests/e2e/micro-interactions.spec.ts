import { expect, test, type Locator, type Page } from "@playwright/test";
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
  // The fill carries the error as well as the border: the Down wash over the card, not the plain card.
  await expect.poll(() => field.evaluate(el => {
    const probe = document.createElement("span"); el.parentElement!.append(probe);
    probe.style.backgroundColor = "color-mix(in srgb, var(--down-mark) var(--invalid-wash), var(--card))";
    const wash = getComputedStyle(probe).backgroundColor;
    probe.style.backgroundColor = "var(--card)";
    const card = getComputedStyle(probe).backgroundColor; probe.remove();
    return wash !== card && getComputedStyle(el).backgroundColor === wash;
  })).toBe(true);
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
  // The check draws its stroke on the enter token while it settles.
  expect(await checkbox.locator("svg path").evaluate(el => { const c = getComputedStyle(el); return `${c.animationName} ${c.animationDuration}`; })).toBe("tick-draw 0.22s");
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
  // The knob slides on the enter token; only its press scale is instant.
  expect(await toggle.locator("..").locator("span").last().evaluate(el => { const c = getComputedStyle(el), at = c.transitionProperty.split(", ").indexOf("translate"); return c.transitionDuration.split(", ")[at]; })).toBe("0.22s");
  const number = dialog.getByRole("spinbutton", { name: "Seats" });
  await number.fill("24"); await dialog.getByRole("button", { name: "Increase Seats" }).click();
  await expect(number).toHaveValue("25");
  // A step rolls the value in from below on the same input; the typed 24 did not.
  expect(await number.evaluate(el => `${el.getAttribute("data-nudge")} ${el.getAttribute("data-nudge-from")} ${getComputedStyle(el).animationName}`)).toBe("a down nudge-a");
  await dialog.getByRole("button", { name: "Decrease Seats" }).click();
  expect(await number.evaluate(el => `${el.getAttribute("data-nudge")} ${el.getAttribute("data-nudge-from")} ${getComputedStyle(el).animationName}`)).toBe("b up nudge-b");
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
    // The check appears without its stroke draw, and a stepped value without its shift.
    const checkbox = dialog.getByRole("checkbox", { name: "Include archived items" });
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(await checkbox.locator("svg path").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    await dialog.getByRole("button", { name: "Increase Seats" }).click();
    expect(await dialog.getByRole("spinbutton", { name: "Seats" }).evaluate(el => { const p = document.createElement("i"); p.style.marginTop = "var(--nudge-y, 0px)"; el.parentElement!.append(p); p.style.setProperty("--nudge-y", getComputedStyle(el).getPropertyValue("--nudge-y")); const v = getComputedStyle(p).marginTop; p.remove(); return v; })).toBe("0px");
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ds");
  const input = page.getByLabel("Verification code", { exact: true });
  const root = input.locator("..");
  const activeCell = () => root.locator('[data-slot="otp-cell"]').evaluateAll(cells => cells.findIndex(cell => cell.getAttribute("data-current") === "true"));
  await input.fill("123456");
  await expect(input).toHaveValue("123456");
  // A typed digit rises into its cell on the enter token.
  expect(await root.locator('[data-slot="otp-cell"] > .animate-swap').first().evaluate(el => { const c = getComputedStyle(el); return `${c.animationName} ${c.animationDuration}`; })).toBe("digit-in 0.22s");
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

test("text reveal: each piece runs on the reveal tokens, 40 ms apart, and ends visible; reduced motion fades only", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ds");
  const card = page.locator('[data-demo="text-reveal"]');
  await card.scrollIntoViewIfNeeded();
  const pieces = card.locator(".reveal-text[data-shown] [data-piece]");
  const timing = () => pieces.evaluateAll(els => els.map(el => { const c = getComputedStyle(el); return `${c.animationName} ${c.animationDuration} ${c.animationDelay} ${c.animationTimingFunction}`; }));
  await expect(pieces).toHaveCount(7);
  expect((await timing()).slice(0, 2)).toEqual(["text-reveal 0.7s 0s cubic-bezier(0.2, 0.7, 0.2, 1)", "text-reveal 0.7s 0.04s cubic-bezier(0.2, 0.7, 0.2, 1)"]);
  await expect(pieces.last()).toHaveCSS("opacity", "1");
  await expect(pieces.last()).toHaveCSS("filter", "blur(0px)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await card.getByRole("button", { name: "Replay text reveal", exact: true }).click();
  await expect(pieces).toHaveCount(7);
  expect((await timing()).at(-1)).toMatch(/^fade-in 0\.1s 0s /);
  await expect(pieces.last()).toHaveCSS("opacity", "1");
});

test("a menu and a popover enter from the side they open on, by the enter shift; reduced motion drops the shift", async ({ page }) => {
  /** `side x y`: the panel's Radix side and the enter translate tw-animate reads there, resolved to pixels. */
  const shift = (panel: Locator) => panel.evaluate(el => {
    // The variables are registered without inheritance (tw-animate), so they are read on the panel and resolved on a probe.
    const own = getComputedStyle(el), probe = document.createElement("i");
    probe.style.position = "absolute";
    probe.style.marginLeft = own.getPropertyValue("--tw-enter-translate-x");
    probe.style.marginTop = own.getPropertyValue("--tw-enter-translate-y");
    el.append(probe);
    const c = getComputedStyle(probe), out = `${el.getAttribute("data-side")} ${c.marginLeft} ${c.marginTop}`;
    probe.remove();
    return out;
  });
  const FROM_SIDE = ["bottom 0px -6px", "top 0px 6px", "right -6px 0px", "left 6px 0px"];
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ds");
  const menu = page.locator('[data-slot="dropdown-menu-content"]');
  await page.getByRole("button", { name: "Gallery actions", exact: true }).click();
  await expect(menu).toBeVisible();
  expect(FROM_SIDE).toContain(await shift(menu));
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  const popover = page.locator('[data-slot="popover-content"]');
  await page.getByRole("button", { name: "Open popover", exact: true }).click();
  await expect(popover).toBeVisible();
  expect(FROM_SIDE).toContain(await shift(popover));
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Gallery actions", exact: true }).click();
  await expect(menu).toBeVisible();
  expect(await shift(menu)).toMatch(/ 0px 0px$/);
});
