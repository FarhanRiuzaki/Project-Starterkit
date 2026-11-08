import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";

test.use({ storageState: AUTH_STATE });

/** Identify the production account-items chunk by its UI vocabulary, independently of hashed bundle names. */
function accountChunks() {
  const chunks = path.resolve(import.meta.dirname, "../../", process.env.NEXT_DIST_DIR ?? ".next-e2e", "static/chunks");
  const files = readdirSync(chunks).filter(file => file.endsWith(".js") && readFileSync(path.join(chunks, file), "utf8").includes("Color palette"));
  expect(files.length).toBeGreaterThan(0);
  return new Set(files);
}

for (const key of ["Enter", " ", "ArrowDown"]) {
  test(`cold account menu ${key}: delayed items receive keyboard focus and Escape returns to trigger`, async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const events: unknown[] = [];
      Object.assign(window, { accountFocusProbe: events });
      for (const type of ["focusin", "focusout", "keydown", "keyup", "click"]) document.addEventListener(type, event => {
        const target = event.target instanceof Element ? event.target : null;
        const active = document.activeElement;
        if (target?.closest("[aria-label$=\"account menu\"]") || type.startsWith("key")) events.push({ type, key: event instanceof KeyboardEvent ? event.key : null, ms: performance.now(), target: target?.getAttribute("aria-label"), active: active?.getAttribute("aria-label"), activeTag: active?.tagName, id: target?.id });
      }, true);
    });
    if (process.env.ACCOUNT_PROBE_CPU) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.ACCOUNT_PROBE_CPU) });
    }
    const chunks = accountChunks();
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/_next/static/chunks/*.js", async route => {
      if (chunks.has(new URL(route.request().url()).pathname.split("/").at(-1)!)) await held;
      await route.continue();
    });
    try {
      await page.goto("/users");
      const trigger = page.getByRole("button", { name: /account menu$/ }).first();
      await trigger.focus();
      await page.keyboard.press(key);
      const menu = page.getByRole("menu");
      await expect(menu).toContainText("Loading account menu…");
      release();
      await expect(menu.getByRole("menuitem", { name: "Profile", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(page.getByRole("menuitem", { name: "Security", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    } finally {
      release();
      const probe = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, events: (window as unknown as { accountFocusProbe: unknown[] }).accountFocusProbe })).catch(() => ({ unavailable: "Page closed before diagnostics could be read." }));
      const file = path.join(SCRATCH, `account-focus-${key === " " ? "Space" : key}-${testInfo.repeatEachIndex}.json`);
      writeFileSync(file, JSON.stringify({ key, cpu: process.env.ACCOUNT_PROBE_CPU ?? "1", source: process.env.E2E_SOURCE_REVISION, ...probe }, null, 2));
      await testInfo.attach("account-focus-probe", { path: file, contentType: "application/json" });
    }
  });
}

test("account chunk failure offers recovery inside the menu", async ({ page }) => {
  const chunks = accountChunks();
  await page.route("**/_next/static/chunks/*.js", route => chunks.has(new URL(route.request().url()).pathname.split("/").at(-1)!) ? route.abort() : route.continue());
  await page.goto("/users");
  const trigger = page.getByRole("button", { name: /account menu$/ }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const recovery = page.getByRole("menu").getByRole("menuitem", { name: "Couldn't load account menu. Reload page", exact: true });
  await expect(recovery).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(recovery).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("closing during account loading does not reopen after the chunk arrives", async ({ page }) => {
  const chunks = accountChunks();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    if (chunks.has(new URL(route.request().url()).pathname.split("/").at(-1)!)) await held;
    await route.continue();
  });
  try {
    await page.goto("/users");
    const trigger = page.getByRole("button", { name: /account menu$/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toContainText("Loading account menu…");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    const loaded = page.waitForResponse(response => chunks.has(new URL(response.url()).pathname.split("/").at(-1)!));
    release();
    await loaded;
    await expect(page.getByRole("menu")).toBeHidden();
    await trigger.click();
    await expect(page.getByRole("menuitem", { name: "Profile", exact: true })).toBeVisible();
  } finally { release(); }
});
