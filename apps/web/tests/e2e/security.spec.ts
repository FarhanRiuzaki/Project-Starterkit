import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { csrfOf, signIn } from "./helpers";

test("private responses stay isolated; direct calls enforce auth, CSRF and origin", async ({ browser, baseURL }) => {
  const anonymous = await browser.newContext({ baseURL });
  const owner = await browser.newContext({ baseURL, storageState: AUTH_STATE });
  const other = await browser.newContext({ baseURL });
  try {
    expect((await anonymous.request.get("/api/me")).status()).toBe(401);
    const profile = await owner.request.get("/api/me");
    expect(profile.status()).toBe(200);
    expect(profile.headers()["cache-control"]).toContain("no-store");
    const user = await profile.json();
    expect(JSON.stringify(user)).not.toMatch(/passwordHash|totpSecret|recoveryCodes/);
    const page = await other.newPage();
    await signIn(page, "viewer");
    await expect(page).toHaveURL("/");
    const viewer = await other.request.get("/api/me");
    expect(viewer.status()).toBe(200);
    expect((await viewer.json()).id).not.toBe(user.id);
    expect(viewer.headers()["cache-control"]).toContain("no-store");
    expect((await anonymous.request.get("/api/me")).status()).toBe(401);
    const csrf = await owner.request.patch("/api/me", { data: { name: "Must not save" } });
    expect(csrf.status()).toBe(403);
    expect((await csrf.json()).error.code).toBe("csrf");
    // A hostile Origin value is a local request header; no traffic goes to that domain.
    const origin = await anonymous.request.post("/api/auth/login", { headers: { origin: "https://untrusted.invalid", "sec-fetch-site": "cross-site" }, data: { login: "viewer", password: "dummy-wrong-password" } });
    expect(origin.status()).toBe(403);
    const sessions = await (await owner.request.get("/api/me/sessions")).json();
    const idor = await other.request.delete(`/api/me/sessions/${sessions.items[0].id}`, { headers: { "x-csrf-token": await csrfOf(page) } });
    expect(idor.status()).toBe(404);
    const injection = await owner.request.get("/api/users", { params: { q: "%' OR 1=1 --" } });
    expect(injection.status()).toBe(200);
    expect((await injection.json()).total).toBe(0);
    const invalid = await owner.request.get("/api/users?page=1001");
    expect(invalid.status()).toBe(400);
    const oversized = await anonymous.request.post("/api/auth/login", { headers: { origin: baseURL! }, data: { login: "a".repeat(70_000), password: "dummy" } });
    expect(oversized.status()).toBe(400);
    const document = await owner.request.get("/");
    expect(document.headers()["cache-control"]).toContain("no-store");
    const csp = document.headers()["content-security-policy"]!;
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(document.headers()["x-content-type-options"]).toBe("nosniff");
  } finally { await Promise.all([anonymous.close(), owner.close(), other.close()]); }
});

test("login fetches only the visible theme's decorative artwork", async ({ browser, baseURL }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ baseURL, colorScheme });
    const page = await context.newPage();
    const artwork: string[] = [];
    page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith("/illustrations/auth-landscape")) artwork.push(path); });
    try {
      const response = await page.goto("/login");
      expect(response?.ok()).toBe(true);
      await page.waitForLoadState("networkidle");
      expect(artwork).toEqual([`/illustrations/auth-landscape${colorScheme === "dark" ? "-dark" : ""}.svg`]);
      const art = await page.request.get(artwork[0]!);
      expect(art.status()).toBe(200);
      expect(art.headers()["content-type"]).toContain("image/svg+xml");
    } finally { await context.close(); }
  }
});
