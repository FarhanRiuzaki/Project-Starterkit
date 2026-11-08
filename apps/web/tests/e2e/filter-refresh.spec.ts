import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";

test.use({ storageState: AUTH_STATE, viewport: { width: 1440, height: 900 } });
for (const { height, active, motion } of [
  { height: 900, active: false, motion: "no-preference" },
  { height: 900, active: true, motion: "reduce" },
  { height: 399, active: false, motion: "no-preference" },
  { height: 400, active: true, motion: "reduce" },
] as const) for (const cache of ["cold", "warm"]) test(`${cache} ${height} ${active} ${motion} refresh keeps the collapsed rail aligned with its content through hydration`, async ({ page }) => {
  const label = `${cache}-${height}-${active ? "active" : "empty"}-${motion}`;
  const captureDir = path.join(SCRATCH, "refresh-captures", `${label}-${Date.now()}`);
  mkdirSync(captureDir, { recursive: true });
  const captures: { file: string; sha256: string; bytes: number; cdpTimestamp: number | null; writtenAt: string; navigation: unknown }[] = [];
  await page.setViewportSize({ width: 1440, height });
  await page.emulateMedia({ reducedMotion: motion, colorScheme: active ? "dark" : "light" });
  const route = active ? "/permissions?module=user" : "/permissions";
  await page.addInitScript(() => {
    const frames: unknown[] = [];
    Object.assign(window, { filterRefreshFrames: frames });
    const start = performance.now();
    const nodes = new WeakMap<Element, number>();
    let serial = 0;
    const sample = () => {
      const rail = document.querySelector<HTMLElement>('[data-slot="filter-launcher"]');
      const result = document.querySelector<HTMLElement>('[data-slot="filter-results"]');
      if (rail && result) {
        const r = rail.getBoundingClientRect(), a = result.getBoundingClientRect(), style = getComputedStyle(rail);
        if (!nodes.has(rail)) nodes.set(rail, ++serial);
        const ancestors = [];
        for (let parent = rail.parentElement; parent; parent = parent.parentElement) {
          const computed = getComputedStyle(parent);
          ancestors.push({ slot: parent.dataset.slot, className: parent.className, opacity: computed.opacity, transform: computed.transform, animation: computed.animationName });
        }
        frames.push({ own: { opacity: style.opacity, transform: style.transform, animation: style.animationName }, ancestors, node: nodes.get(rail), copies: document.querySelectorAll('[data-slot="filter-launcher"]').length, theme: document.documentElement.className, ms: performance.now(), rail: { x: r.x, y: r.y, width: r.width, height: r.height }, anchorTop: a.top, delta: r.top - a.top, visible: r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none", local: !!rail.closest('[data-slot="filter-layout"]') });
      }
      if (!(window as unknown as { filterRefreshStop?: boolean }).filterRefreshStop && performance.now() - start < 15000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  if (cache === "cold") await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Page.enable");
  const navigationOf = (frame: { id: string; loaderId: string; url: string }) => ({ frameId: frame.id, loaderId: frame.loaderId, url: frame.url });
  let navigation = navigationOf((await cdp.send("Page.getFrameTree")).frameTree.frame);
  cdp.on("Page.frameNavigated", ({ frame }) => { if (!frame.parentId) navigation = navigationOf(frame); });
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  if (cache === "warm") await page.goto(route);
  let frame = 0;
  cdp.on("Page.screencastFrame", event => {
    if (frame < 40) {
      const file = `frame-${String(frame++).padStart(3, "0")}.jpg`;
      const bytes = Buffer.from(event.data, "base64");
      writeFileSync(path.join(captureDir, file), bytes);
      captures.push({ file, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, cdpTimestamp: event.metadata.timestamp ?? null, writtenAt: new Date().toISOString(), navigation: { ...navigation } });
    }
    void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 65, everyNthFrame: 1 });
  if (cache === "warm") await page.reload(); else await page.goto(route);
  await expect(page.locator('[data-slot="filter-panel-trigger"]')).toHaveAttribute("data-state", "closed");
  const ready = await page.evaluate(() => performance.now());
  const settled = await page.evaluate(async () => {
    await document.fonts.ready;
    const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity));
    await Promise.allSettled(finite.map(animation => animation.finished));
    const at = performance.now();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { Object.assign(window, { filterRefreshStop: true }); resolve(); })));
    return at;
  });
  await cdp.send("Page.stopScreencast");
  await page.screenshot({ path: path.join(captureDir, "settled.png") });
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  const frames = await page.evaluate(() => (window as unknown as { filterRefreshFrames: { delta: number; visible: boolean; ms: number; node: number; copies: number; theme: string; rail: { height: number }; own: { opacity: string; transform: string; animation: string } }[] }).filterRefreshFrames);
  writeFileSync(path.join(captureDir, "frames.json"), JSON.stringify({ ready, settled, frames }, null, 2));
  const manifest = {
    label, captureDir, url: page.url(), navigation, ready, settled, browserErrors: errors, consoleErrors,
    timeOrigin: await page.evaluate(() => performance.timeOrigin),
    sourceRevision: process.env.E2E_SOURCE_REVISION ?? null,
    probeSha256: createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex"),
    buildId: readFileSync(path.resolve(import.meta.dirname, "../../", process.env.NEXT_DIST_DIR ?? ".next-e2e", "BUILD_ID"), "utf8").trim(),
    runtime: { node: process.version, bun: execFileSync("bun", ["--version"], { encoding: "utf8" }).trim(), browser: page.context().browser()?.version(), platform: process.platform },
    conditions: { cpuThrottle: 4, cache, viewport: page.viewportSize(), active, motion, theme: active ? "dark" : "light" },
    frames: "frames.json", settledScreenshot: "settled.png", captures,
  };
  writeFileSync(path.join(captureDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(SCRATCH, `refresh-${label}-manifest.json`), JSON.stringify(manifest, null, 2));
  expect(frames.at(-1)!.ms).toBeGreaterThanOrEqual(settled);
  expect(frames.filter(frame => frame.visible).length).toBeGreaterThan(0);
  const visible = frames.filter(frame => frame.visible);
  expect(Math.max(...visible.map(frame => Math.abs(frame.delta)))).toBeLessThanOrEqual(1);
  expect(visible.every(frame => frame.own.opacity === "1" && frame.own.transform === "none" && frame.own.animation === "none")).toBe(true);
  expect(new Set(visible.map(frame => frame.node)).size).toBe(1);
  expect(visible.every(frame => frame.copies === 1)).toBe(true);
  expect(Math.max(...visible.map(frame => frame.rail.height)) - Math.min(...visible.map(frame => frame.rail.height))).toBeLessThanOrEqual(1);
  expect(visible.every(frame => /\bdark\b/.test(frame.theme) === active)).toBe(true);
});


test("early keyboard expansion survives a delayed primitive without moving the rail or losing focus", async ({ page }) => {
  const directory = path.resolve(import.meta.dirname, "../../", process.env.NEXT_DIST_DIR ?? ".next-e2e", "static/chunks");
  const chunks = new Set(readdirSync(directory).filter(file => file.endsWith(".js") && readFileSync(path.join(directory, file), "utf8").includes("Your selections are kept.")));
  expect(chunks.size).toBeGreaterThan(0);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    if (chunks.has(new URL(route.request().url()).pathname.split("/").at(-1)!)) await held;
    await route.continue();
  });
  try {
    await page.goto("/permissions", { waitUntil: "domcontentloaded" });
    const trigger = page.getByRole("button", { name: "Expand filters", exact: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(page.getByText("Loading filters…", { exact: true })).toBeAttached();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Filters", exact: true })).toHaveCount(0);
    const delta = await page.evaluate(() => document.querySelector('[data-slot="filter-launcher"]')!.getBoundingClientRect().y - document.querySelector('[data-slot="filter-results"]')!.getBoundingClientRect().y);
    expect(Math.abs(delta)).toBeLessThanOrEqual(1);
    release();
    const panel = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(panel.getByRole("heading", { name: "Filters", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    await expect(panel).toBeHidden();
  } finally { release(); }
});
