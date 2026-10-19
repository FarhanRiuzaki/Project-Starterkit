import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";

/**
 * No flicker (spec "Tanpa flicker", AGENTS.md §8). A probe installed before any page script records every interval in
 * which a loading state is on screen: an element with aria-busy="true" or a skeleton block that is visible (not
 * visibility:hidden, not opacity 0). It samples on every DOM mutation and every animation frame, so a CSS-delayed
 * reveal is seen too. A loading state may not show at all, or must stay at least FLASH_MIN ms: an interval of
 * 1 to FLASH_MIN ms is a flash and fails. Layout shift (PerformanceObserver "layout-shift", without recent input)
 * must stay under CLS_MAX. A document load must not ask /api for its first data: the server rendered it.
 * The probe also records blank gaps: intervals in which the page region (main) shows neither visible text nor a
 * visible loading state. A gap may last one frame (FRAME ms), or longer only while a page fade-in runs over it
 * (the region is fading in from nothing anyway); anything else is a blank flash and fails.
 */
const FLASH_MIN = 300;
const FRAME = 20;
const CLS_MAX = 0.01;
const OUT = SCRATCH;
const STATE = AUTH_STATE;

/** Each page and a string only its loaded data renders into the server HTML. */
const PAGES = [
  { path: "/", filled: 'data-slot="stat-tile"' },
  { path: "/users", filled: 'href="/users/u-002"' },
  { path: "/users/u-002", filled: "Effective permissions" },
  { path: "/roles", filled: 'href="/roles/role-viewer"' },
  { path: "/audit/activity", filled: "View entry" },
  { path: "/me", filled: 'id="me-username"' },
] as const;

type Interval = { at: number; ms: number; path: string; what: string };
type Shift = { at: number; value: number; input: boolean; path: string };
type Gap = { at: number; ms: number; path: string; faded: boolean };
type Probe = {
  intervals: Interval[]; open: { at: number; path: string; what: string } | null; shifts: Shift[];
  gaps: Gap[]; gap: { at: number; path: string; faded: boolean } | null;
};
declare global { interface Window { __flicker: Probe } }

/** Runs in the page before its scripts (addInitScript). */
function installProbe() {
  const st: Probe = { intervals: [], open: null, shifts: [], gaps: [], gap: null };
  window.__flicker = st;
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };
  const loadingNow = () => {
    for (const el of document.querySelectorAll('[aria-busy="true"], [data-slot="skeleton"]')) {
      if (shown(el)) return el.getAttribute("aria-busy") === "true" ? `busy:${el.tagName.toLowerCase()}` : "skeleton";
    }
    return null;
  };
  /** The page region shows something: a visible loading state, or text that isn't visibility-hidden (opacity is a fade, not a gap). */
  const filled = (main: Element) => {
    if (loadingNow()) return true;
    const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (n.textContent?.trim() && el && el.checkVisibility({ visibilityProperty: true }) && el.getBoundingClientRect().width > 0) return true;
    }
    return false;
  };
  const fading = (main: Element) => main.getAnimations({ subtree: true })
    .some((a) => a.playState === "running" && ["page-enter", "fade-in"].includes((a as CSSAnimation).animationName));
  const gapTick = (now: number) => {
    const main = document.querySelector("#content");
    const blank = !!main && !filled(main);
    if (blank && !st.gap) st.gap = { at: now, path: location.pathname, faded: fading(main!) };
    else if (blank && st.gap) st.gap.faded &&= fading(main!);
    else if (!blank && st.gap) {
      st.gaps.push({ at: Math.round(st.gap.at), ms: Math.round(now - st.gap.at), path: st.gap.path, faded: st.gap.faded });
      st.gap = null;
    }
  };
  const tick = () => {
    const now = performance.now();
    gapTick(now);
    const what = loadingNow();
    if (what && !st.open) st.open = { at: now, path: location.pathname, what };
    else if (!what && st.open) {
      st.intervals.push({ at: Math.round(st.open.at), ms: Math.round(now - st.open.at), path: st.open.path, what: st.open.what });
      st.open = null;
    }
  };
  new MutationObserver(tick).observe(document, { subtree: true, childList: true, attributes: true });
  const frame = () => { tick(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      st.shifts.push({ at: Math.round(e.startTime), value: e.value, input: e.hadRecentInput, path: location.pathname });
    }
  }).observe({ type: "layout-shift", buffered: true });
}

/** Measurements for the report, merged across workers (a failed test restarts its worker). */
const MEASUREMENTS = path.join(OUT, "no-flicker-measurements.json");
const save = (name: string, data: unknown) => {
  const all = existsSync(MEASUREMENTS) ? JSON.parse(readFileSync(MEASUREMENTS, "utf8")) as Record<string, unknown> : {};
  writeFileSync(MEASUREMENTS, JSON.stringify({ ...all, [name]: data }, null, 2));
};

/** Lets late loads, CSS-delayed reveals and the minimum visible time play out, then closes any open interval. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const st = window.__flicker;
    if (st.open) st.intervals.push({ at: Math.round(st.open.at), ms: -1, path: st.open.path, what: `${st.open.what} (still on)` });
    if (st.gap) st.gaps.push({ at: Math.round(st.gap.at), ms: -1, path: st.gap.path, faded: false });
    return { intervals: st.intervals, shifts: st.shifts, gaps: st.gaps };
  });
}

const flashes = (iv: Interval[]) => iv.filter((i) => i.ms >= 1 && i.ms < FLASH_MIN);
const stuck = (iv: Interval[]) => iv.filter((i) => i.ms === -1);
/** Blank gaps longer than a frame that no page fade covered (or still blank after settling). */
const blank = (gs: Gap[]) => gs.filter((g) => g.ms === -1 || (g.ms > FRAME && !g.faded));
const cls = (s: Shift[]) => Math.round(s.filter((x) => !x.input).reduce((n, x) => n + x.value, 0) * 10_000) / 10_000;

for (const mode of [{ name: "light", colorScheme: "light", reducedMotion: "no-preference" }, { name: "dark, reduced motion", colorScheme: "dark", reducedMotion: "reduce" }] as const) {
  test.describe(`document load (${mode.name})`, () => {
    test.use({ storageState: STATE, colorScheme: mode.colorScheme, reducedMotion: mode.reducedMotion });

    for (const p of PAGES) {
      test(`${p.path} renders filled on first paint: no flash, no shift, no /api read`, async ({ page }) => {
        await page.addInitScript(installProbe);
        const api: string[] = [];
        page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(`${r.method()} ${r.url()}`); });
        const res = await page.goto(p.path);
        const html = await res!.text();
        const m = await settle(page);
        save(`load ${mode.name} ${p.path}`, { cls: cls(m.shifts), intervals: m.intervals, gaps: m.gaps, api, filledInHtml: html.includes(p.filled) });
        expect(html, "the server HTML carries the page's data").toContain(p.filled);
        expect(flashes(m.intervals), "loading states shown for 1–300 ms").toEqual([]);
        expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
        expect(stuck(m.intervals), "loading states still on after settling").toEqual([]);
        expect(cls(m.shifts), "cumulative layout shift").toBeLessThan(CLS_MAX);
        expect(api, "requests to /api during the document load").toEqual([]);
      });
    }
  });
}

test.describe("client navigation and table changes", () => {
  test.use({ storageState: STATE });

  test("fast client-side navigation between pages: no flash, no shift, no /api read", async ({ page }) => {
    await page.addInitScript(installProbe);
    await page.goto("/");
    await settle(page);
    await page.evaluate(() => { window.__flicker.intervals = []; window.__flicker.gaps = []; window.__flicker.shifts = []; });
    const api: string[] = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(`${r.method()} ${r.url()}`); });

    const menu = page.getByRole("navigation", { name: "Menu" });
    const go = async (click: () => Promise<void>, title: string | RegExp) => {
      await click();
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    };
    await go(() => menu.getByRole("link", { name: "Users" }).click(), "Users");
    await go(() => page.locator('a[href="/users/u-002"]').first().click(), "Admin User");
    await go(() => menu.getByRole("link", { name: "Roles" }).click(), "Roles");
    await go(() => menu.getByRole("link", { name: "Activity log" }).click(), "Activity log");
    await go(() => menu.getByRole("link", { name: "Profile" }).click(), "Profile");
    await go(() => menu.getByRole("link", { name: "Dashboard" }).click(), "Dashboard");
    await go(() => menu.getByRole("link", { name: "Users" }).click(), "Users");
    const m = await settle(page);
    const navShift = Math.round(m.shifts.reduce((n, x) => n + x.value, 0) * 10_000) / 10_000;
    save("client navigation", { intervals: m.intervals, gaps: m.gaps, shifts: m.shifts, shiftTotal: navShift, api });
    expect(flashes(m.intervals), "loading states shown for 1–300 ms").toEqual([]);
    expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
    expect(stuck(m.intervals)).toEqual([]);
    expect(navShift, "layout shift during the navigations (input or not)").toBeLessThan(CLS_MAX);
    expect(api, "requests to /api during client navigation (the server prefetched each page)").toEqual([]);
  });

  test("revisiting a page after its cache went stale: the server's fresh data is used, no /api refetch", async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(installProbe);
    await page.goto("/users");
    await settle(page);
    const menu = page.getByRole("navigation", { name: "Menu" });
    await menu.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await page.waitForTimeout(11_000); // past the 10 s staleTime of the cached users query
    const api: string[] = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(`${r.method()} ${r.url()}`); });
    await menu.getByRole("link", { name: "Users" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
    const m = await settle(page);
    save("revisit after stale", { api, intervals: m.intervals, gaps: m.gaps });
    expect(api, "requests to /api after revisiting with a stale cache").toEqual([]);
    expect(flashes(m.intervals)).toEqual([]);
    expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
  });

  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    for (const delay of [0, 250]) {
      test(`same-segment navigation (${reducedMotion === "reduce" ? "reduced motion" : "motion"}, page payload +${delay} ms): no flash, no blank gap`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion });
        await page.addInitScript(installProbe);
        await page.route("**/*", async (route) => {
          const h = route.request().headers();
          if (delay && h.rsc === "1" && !h["next-router-prefetch"]) await new Promise((r) => setTimeout(r, delay));
          await route.continue();
        });
        await page.goto("/users");
        await settle(page);
        await page.evaluate(() => { window.__flicker.intervals = []; window.__flicker.gaps = []; });
        const menu = page.getByRole("navigation", { name: "Menu" });
        const steps: [() => Promise<void>, string][] = [
          [() => page.locator('a[href="/users/u-002"]').first().click(), "Admin User"], // users → users/[id]
          [() => menu.getByRole("link", { name: "Profile" }).click(), "Profile"],
          [() => page.locator('a[href="/me/security"]').first().click(), "Security"], // me → me/security
          [() => menu.getByRole("link", { name: "Activity log" }).click(), "Activity log"],
          [() => menu.getByRole("link", { name: "Sign-in log" }).click(), "Sign-in log"], // audit/activity → audit/auth
        ];
        for (const [click, title] of steps) {
          await click();
          await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
          await page.waitForTimeout(400);
        }
        const m = await settle(page);
        save(`same-segment ${reducedMotion} +${delay}`, { intervals: m.intervals, gaps: m.gaps });
        expect(flashes(m.intervals), "loading states shown for 1–300 ms").toEqual([]);
        expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
        expect(stuck(m.intervals)).toEqual([]);
      });
    }
  }

  for (const delay of [100, 250, 600]) {
    test(`slow server (${delay} ms per page): the route loading shape shows only after 150 ms and then stays at least 300 ms`, async ({ page }) => {
      await page.addInitScript(installProbe);
      // Slows the page payload of each client navigation (not the prefetches) as a slow backend would.
      await page.route("**/*", async (route) => {
        const h = route.request().headers();
        if (h.rsc === "1" && !h["next-router-prefetch"]) await new Promise((r) => setTimeout(r, delay));
        await route.continue();
      });
      await page.goto("/");
      await settle(page);
      await page.evaluate(() => { window.__flicker.intervals = []; window.__flicker.gaps = []; });
      const menu = page.getByRole("navigation", { name: "Menu" });
      for (const [link, title] of [["Users", "Users"], ["Roles", "Roles"], ["Activity log", "Activity log"], ["Dashboard", "Dashboard"]]) {
        await menu.getByRole("link", { name: link }).click();
        await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        await page.waitForTimeout(400);
      }
      const m = await settle(page);
      save(`slow server ${delay} ms`, { intervals: m.intervals, gaps: m.gaps });
      expect(flashes(m.intervals), "loading states shown for 1–300 ms").toEqual([]);
      expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
      expect(stuck(m.intervals)).toEqual([]);
      if (delay >= 600) expect(m.intervals.filter((i) => i.what === "busy:div").length, "a slow page shows its loading shape").toBeGreaterThan(0);
    });
  }

  test("sort and page change keep the previous rows on screen, no flash", async ({ page }) => {
    await page.addInitScript(installProbe);
    await page.goto("/users");
    await settle(page);
    await page.evaluate(() => { window.__flicker.intervals = []; window.__flicker.gaps = []; });
    const rows = page.getByRole("table", { name: "Users" }).locator("tbody tr");
    const before = await rows.count();
    // The list API answers after 250 ms, so there is a window in which the next rows are still loading.
    await page.route("**/api/users?*", async (r) => { await new Promise((x) => setTimeout(x, 250)); await r.continue(); });
    const first = () => rows.first().innerText();

    const page1 = await first();
    await page.getByRole("button", { name: "Last sign-in" }).click();
    await expect(page).toHaveURL(/sort=lastLoginAt/);
    expect(await first(), "the previous rows stay while the sorted page loads").toBe(page1);
    expect(await rows.count()).toBe(before);
    await expect.poll(first, { message: "the sorted rows replace them once loaded" }).not.toBe(page1);
    const sorted = await first();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    expect(await first(), "the previous rows stay while the next page loads").toBe(sorted);
    await expect.poll(first, { message: "page 2 replaces them once loaded" }).not.toBe(sorted);
    await page.goBack(); // Back undoes the page change, from the cache, with no loading state
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=lastLoginAt/);
    await expect.poll(first).toBe(sorted);
    const m = await settle(page);
    save("users sort + page", { intervals: m.intervals, gaps: m.gaps });
    expect(await page.locator('[data-slot="skeleton"]:visible').count()).toBe(0);
    expect(flashes(m.intervals), "loading states shown for 1–300 ms").toEqual([]);
    expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
    expect(stuck(m.intervals)).toEqual([]);
  });

  test("slow list API: a sort keeps the previous rows on screen, dimmed as busy after 150 ms, never a skeleton", async ({ page }) => {
    await page.addInitScript(installProbe);
    await page.goto("/users");
    await settle(page);
    // A slow backend: the list API and any page payload answer after 600 ms.
    await page.route("**/*", async (route) => {
      const r = route.request();
      if ((r.headers().rsc === "1" && !r.headers()["next-router-prefetch"]) || new URL(r.url()).pathname === "/api/users") await new Promise((x) => setTimeout(x, 600));
      await route.continue();
    });
    await page.evaluate(() => { window.__flicker.intervals = []; window.__flicker.gaps = []; });
    const table = page.getByRole("table", { name: "Users" });
    await page.getByRole("button", { name: "Last sign-in" }).click();
    await expect(table, "busy feedback within the 150 ms delay plus a frame").toHaveAttribute("aria-busy", "true", { timeout: 450 });
    expect(await table.locator("tbody tr").count(), "the previous rows stay").toBe(15);
    expect(await page.locator('[data-slot="skeleton"]:visible').count(), "no skeleton").toBe(0);
    await expect(table).not.toHaveAttribute("aria-busy", "true", { timeout: 3000 });
    await expect(page).toHaveURL(/sort=lastLoginAt/);
    const m = await settle(page);
    save("users slow sort", { intervals: m.intervals, gaps: m.gaps });
    expect(flashes(m.intervals)).toEqual([]);
    expect(blank(m.gaps), "blank page region longer than a frame, not under a fade").toEqual([]);
  });
});
