import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { collectErrors, heading, settleAnimations, withIds } from "./helpers";

/**
 * Motion end to end (AGENTS.md §8, design-system §7): a client navigation runs the page transition; under reduced
 * motion nothing moves (opacity only); the shared indicator of a segmented control sits on the active option and
 * slides to the next one; no page logs a console error.
 */

/** Samples the page region every frame until stopped: lowest opacity and any non-identity transform of the page box. */
function startSampler(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __motion: { minOpacity: number; moved: boolean; frames: number; stop: boolean } };
    w.__motion = { minOpacity: 1, moved: false, frames: 0, stop: false };
    const identity = (t: string) => t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";
    const tick = () => {
      const st = w.__motion;
      // The entering page: the Framer page swap that isn't leaving, else the template's CSS enter wrapper.
      const box = [...document.querySelectorAll<HTMLElement>("#content [data-page-swap]")].find((el) => !el.querySelector(":scope > [inert]"))
        ?? document.querySelector<HTMLElement>("#content [data-page]")?.parentElement;
      if (box) {
        const s = getComputedStyle(box);
        st.minOpacity = Math.min(st.minOpacity, Number(s.opacity));
        st.moved ||= !identity(s.transform);
        st.frames++;
      }
      if (!st.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const stopSampler = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { __motion: { minOpacity: number; moved: boolean; frames: number; stop: boolean } };
  w.__motion.stop = true;
  return w.__motion;
});

/** Running animations that can move something: transform keyframes or a transform / translate / scale transition. */
const transformAnimations = (page: Page) => page.evaluate(() => document.getAnimations().flatMap((a) => {
  const keys = (a.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
  const target = (a.effect as KeyframeEffect | null)?.target;
  const prop = (a as CSSTransition).transitionProperty;
  const name = (a as CSSAnimation).animationName;
  if (a.playState !== "running") return [];
  if (!(keys.some((k) => "transform" in k || "translate" in k || "scale" in k) || ["transform", "translate", "scale"].includes(prop))) return [];
  // tw-animate's enter / exit keyframes name a transform, but reduced motion zeroes their inputs: they only fade.
  if ((name === "enter" || name === "exit") && target) {
    const s = getComputedStyle(target);
    if (["scale", "translate-x", "translate-y"].every((v) => ["1", "0", ""].includes(s.getPropertyValue(`--tw-${name}-${v}`).trim()))) return [];
  }
  return [`${name ?? prop} on ${target instanceof Element ? target.tagName.toLowerCase() + (target.getAttribute("data-slot") ? `[${target.getAttribute("data-slot")}]` : "") : "?"}`];
}));

/** Waits until the deferred Framer layer has loaded (after idle), so the next navigation uses the page swap. */
async function navigateTwice(page: Page) {
  const menu = page.getByRole("navigation", { name: "Menu" });
  await menu.getByRole("link", { name: "Users", exact: true }).click();
  await heading(page, "Users");
  await settleAnimations(page);
  await startSampler(page);
  await menu.getByRole("link", { name: "Roles" }).click();
  await heading(page, "Roles");
  await settleAnimations(page);
  return stopSampler(page);
}

/** The segmented control's indicator box and the active option's box, relative to the control. */
const indicatorFit = (page: Page) => page.getByRole("radiogroup", { name: "Sign-in method" }).evaluate((group) => {
  const bar = group.querySelector<HTMLElement>(".indicator-move")!;
  const on = group.querySelector<HTMLElement>("[role=radio][aria-checked=true]")!;
  const g = group.getBoundingClientRect(), b = bar.getBoundingClientRect(), o = on.getBoundingClientRect();
  return { dx: Math.abs(b.left - o.left), dw: Math.abs(b.width - o.width), visible: b.width > 0 && b.left >= g.left - 1 && getComputedStyle(bar).opacity !== "0" };
});

test.describe("default motion", () => {
  test.use({ storageState: AUTH_STATE, reducedMotion: "no-preference" });

  test("a client navigation fades and lifts the new page in, and it lands at rest", async ({ page }) => {
    await page.goto("/");
    await heading(page, "Dashboard");
    await page.waitForLoadState("networkidle");
    const m = await navigateTwice(page);
    expect(m.frames, "frames sampled during the navigation").toBeGreaterThan(5);
    expect(m.minOpacity, "the new page faded in").toBeLessThan(0.9);
    expect(m.moved, "the new page rose into place").toBe(true);
    const rest = await page.locator("#content [data-page-swap]").last().evaluate((el) => ({ o: getComputedStyle(el).opacity, t: getComputedStyle(el).transform }));
    expect(rest.o).toBe("1");
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(rest.t);
  });
});

test.describe("reduced motion", () => {
  test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

  test("a client navigation only fades: nothing moves", async ({ page }) => {
    await page.goto("/");
    await heading(page, "Dashboard");
    await page.waitForLoadState("networkidle");
    const m = await navigateTwice(page);
    expect(m.frames).toBeGreaterThan(5);
    expect(m.moved, "a transform on the page box under reduced motion").toBe(false);
    expect(await transformAnimations(page)).toEqual([]);
  });

  test("a menu and a dialog open without movement", async ({ page }) => {
    await page.goto("/users");
    await heading(page, "Users");
    await settleAnimations(page);
    await page.getByRole("button", { name: /account menu$/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await transformAnimations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await transformAnimations(page)).toEqual([]);
  });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`segmented indicator (${reducedMotion === "reduce" ? "reduced motion: jumps" : "slides"}) and sits on the active option`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/login");
    const fits = async () => { const f = await indicatorFit(page); return f.visible && f.dx <= 1 && f.dw <= 1; };
    await expect.poll(fits, { message: "the indicator covers Password" }).toBe(true);
    // Every frame for 600 ms after the click: the indicator's left edge. A slide passes through in-between positions;
    // a jump shows only the old and the new one.
    const bar = page.getByRole("radiogroup", { name: "Sign-in method" }).locator(".indicator-move");
    const lefts = bar.evaluate((el) => new Promise<number>((done) => {
      const seen = new Set<number>();
      const t0 = performance.now();
      const tick = () => {
        seen.add(Math.round(el.getBoundingClientRect().left));
        if (performance.now() - t0 < 600) requestAnimationFrame(tick); else done(seen.size);
      };
      requestAnimationFrame(tick);
    }));
    await page.getByRole("radio", { name: "LDAP" }).click();
    if (reducedMotion === "reduce") expect(await lefts, "positions the indicator passed through").toBeLessThanOrEqual(2);
    else expect(await lefts, "positions the indicator passed through").toBeGreaterThan(3);
    await expect.poll(fits, { message: "the indicator covers LDAP" }).toBe(true);
  });
}

test.describe("console", () => {
  test.use({ storageState: AUTH_STATE });

  test("no console error or page error on any screen, loaded or navigated to", async ({ page, baseURL }) => {
    const errors = collectErrors(page);
    for (const p of ["/", "/users", "/users/{admin}", "/users/{admin}/edit", "/users/new", "/roles", "/roles/{adminRole}", "/permissions",
      "/audit/activity", "/audit/auth", "/me", "/me/security", "/me/sessions", "/ds"]) {
      await page.goto(await withIds(p, baseURL));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    const menu = page.getByRole("navigation", { name: "Menu" });
    for (const name of ["Dashboard", "Users", "Roles", "Permissions", "Activity log", "Sign-in log", "Design system", "Profile"]) {
      await menu.getByRole("link", { name }).click();
      await heading(page, name);
    }
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("the sign-in pages log no console error", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = collectErrors(page);
    for (const p of ["/login", "/forgot-password", "/reset-password?token=x"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
