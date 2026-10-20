import { createHmac } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, request } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";

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
