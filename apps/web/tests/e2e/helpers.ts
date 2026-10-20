import { createHmac } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, request } from "@playwright/test";
import { AUTH_STATE, PENDING_2FA } from "./global-setup";

/**
 * Seed accounts (apps/api/src/db/seed/demo.ts; README "Seed accounts"). Written out here on purpose: the E2E checks the
 * documented values, not whatever the seed module happens to export.
 */
export const SEED = { password: "Password123!", ldapPassword: "LdapPass123!", totpSecret: "JBSWY3DPEHPK3PXP" } as const;

function base32(s: string): Buffer {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "")) bits += a.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), written independently of the API's auth/totp.ts. */
export function totp(secret: string, t = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(t / 30_000)));
  const h = createHmac("sha1", base32(secret)).update(counter).digest();
  const o = (h[h.length - 1] ?? 0) & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/**
 * Signs in through the sign-in form (each call counts against the sign-in rate limit: 10 per minute per client,
 * 5 per username). Lands wherever the app sends the user next; the caller checks where.
 */
export async function signIn(page: Page, login: string, password: string = SEED.password, method: "Password" | "LDAP" = "Password") {
  await page.goto("/login");
  if (method === "LDAP") await page.getByRole("radio", { name: "LDAP" }).click();
  await page.locator("#login").fill(login);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * The session's CSRF token, read where the browser gets it: the signed-in layout hands it to AuthProvider, so it is
 * in the page's server-rendered payload.
 */
export async function csrfOf(page: Page): Promise<string> {
  const html = await (await page.request.get("/")).text();
  const m = /\\"csrf\\":\\"([A-Za-z0-9_-]+)\\"/.exec(html);
  if (!m?.[1]) throw new Error("no CSRF token in the signed-in page");
  return m[1];
}

/**
 * Lets enter / reveal / flash animations finish first (a half-faded row reads as low contrast). Endless ones
 * (shimmer, spinners) are skipped. Quiet twice, 400 ms apart: rows that load late fade in after the first check.
 */
export async function settleAnimations(page: Page) {
  const running = () => page.evaluate(() => document.getAnimations()
    .filter((a) => a.playState !== "finished" && a.effect?.getTiming().iterations !== Infinity).length);
  for (let quiet = 0, t = 0; quiet < 2 && t < 40; t++) {
    quiet = (await running()) === 0 ? quiet + 1 : 0;
    await page.waitForTimeout(quiet === 1 ? 400 : 100);
  }
}

/** axe (WCAG 2.0–2.2 A/AA) violations of impact serious or critical, as "rule: selector | selector". */
export async function axeSerious(page: Page): Promise<string[]> {
  await settleAnimations(page);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

/** Console errors and uncaught page errors from now on (CSP violations and hydration errors land here too). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

let pending: Promise<string> | null = null;
/**
 * Storage state of a sign-in that passed the password step of twofa@example.com and waits for its second factor
 * (valid 10 minutes). Made once and reused for 8 minutes across workers and projects, so the per-username sign-in
 * limit (5 per minute) is never reached by the pages that need it.
 */
export function pending2faState(browser: Browser): Promise<string> {
  return (pending ??= (async () => {
    if (existsSync(PENDING_2FA) && Date.now() - statSync(PENDING_2FA).mtimeMs < 8 * 60_000) return PENDING_2FA;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, "twofa@example.com");
    await page.waitForURL("/login/2fa");
    await ctx.storageState({ path: PENDING_2FA });
    await ctx.close();
    return PENDING_2FA;
  })());
}

/**
 * The page never scrolls sideways (design-system §0): the document is no wider than the window, from 360 px up. A
 * mobile browser zooms out to fit a page that is too wide (innerWidth grows with it), so the width is also checked
 * against the emulated screen. On a failure the message names the outermost elements that stick out past it.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  const m = await page.evaluate((screen) => {
    const iw = Math.min(window.innerWidth, screen || Infinity);
    const sw = document.documentElement.scrollWidth;
    /** Right edge of the element or of its ::before hit area (base.css), when no ancestor clips it. */
    const right = (el: Element) => {
      const r = el.getBoundingClientRect();
      const b = getComputedStyle(el, "::before");
      const hit = b.content !== "none" && b.position === "absolute" ? (parseFloat(b.width) - r.width) / 2 : 0;
      return r.right + Math.max(0, hit);
    };
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
      return false;
    };
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.className).split(/\s+/).slice(0, 4).join(".")}`;
    const offenders = sw <= iw ? [] : [...document.querySelectorAll("body *")]
      .filter((el) => right(el) > iw + 0.5 && !clipped(el)).slice(0, 5).map((el) => `${name(el)} (right ${Math.round(right(el))})`);
    return { iw, sw, offenders };
  }, width);
  expect(m.sw, `${page.url()}: the page scrolls sideways (scrollWidth ${m.sw} > ${m.iw}); sticking out: ${m.offenders.join(" | ")}`).toBeLessThanOrEqual(m.iw);
}

/**
 * Visible controls whose hit area is under 44 × 44 px (design-system §0, touch): the larger of the element's box and
 * its `::before` hit area (base.css, pointer: coarse); a native checkbox or radio is hit through its label.
 */
export async function smallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const SEL = ["button", "[role=button]", "[data-slot=button]", "[role=tab]", "[role=checkbox]", "[role=radio]", "[role=switch]", "[role=menuitem]",
      "[role=menuitemradio]", "[role=menuitemcheckbox]", "[role=option]", "summary", "nav a", "select", "input:not([type=hidden])", "textarea"].join(",");
    const MIN = 44 - 0.5;
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(SEL)) {
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: false }) || el.closest("[inert], [aria-hidden=true]")) continue;
      const native = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
      const t = (native && el.closest("label")) || el;
      const r = t.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue; // sr-only
      const b = getComputedStyle(t, "::before");
      const hit = b.content !== "none" && b.position === "absolute";
      const w = Math.max(r.width, hit ? parseFloat(b.width) : 0), h = Math.max(r.height, hit ? parseFloat(b.height) : 0);
      if (w < MIN || h < MIN) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(w)}×${Math.round(h)}`);
    }
    return small;
  });
}

export const heading = (page: Page, name: string | RegExp) => expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

/** Ids of demo records; the API's seed makes them (UUIDv7), so tests look them up instead of writing them out. */
export type DemoIds = { admin: string; superadmin: string; superadminRole: string; adminRole: string; viewerRole: string };
let ids: Promise<DemoIds> | null = null;

/** The demo ids, read once per worker through /api as the global-setup Superadmin (any role may call it). */
export function demoIds(baseURL: string | undefined): Promise<DemoIds> {
  return (ids ??= (async () => {
    const api = await request.newContext({ baseURL, storageState: AUTH_STATE });
    const get = async <T>(path: string) => {
      const r = await api.get(path);
      expect(r.status(), path).toBe(200);
      return (await r.json()) as T;
    };
    const user = async (email: string) =>
      (await get<{ items: { id: string; email: string }[] }>(`/api/users?q=${encodeURIComponent(email)}`)).items.find((u) => u.email === email)!.id;
    const roles = (await get<{ items: { id: string; name: string }[] }>("/api/roles?pageSize=100")).items;
    const role = (name: string) => roles.find((r) => r.name === name)!.id;
    const out = { admin: await user("admin@example.com"), superadmin: await user("superadmin@example.com"),
      superadminRole: role("Superadmin"), adminRole: role("Admin"), viewerRole: role("Viewer") };
    await api.dispose();
    return out;
  })());
}

/** `path` with each `{name}` replaced by that demo id ("/users/{admin}" → "/users/0199…"). */
export async function withIds(path: string, baseURL: string | undefined): Promise<string> {
  const d = await demoIds(baseURL);
  return path.replace(/\{(\w+)\}/g, (_, k: keyof DemoIds) => d[k]);
}
