import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { csrfOf } from "./helpers";
import path from "node:path";

test.use({ storageState: AUTH_STATE });

test("real activity entry opens a shareable independent URL and Close/Back/Forward preserve list context", async ({ page }) => {
  await page.goto("/projects");
  const headers = { "x-csrf-token": await csrfOf(page) };
  const name = `Entry investigation ${Date.now()}`;
  const created = await page.request.post("/api/projects", { headers, data: { name } });
  expect(created.status()).toBe(201);
  const project = await created.json();
  try {
    expect((await page.request.patch(`/api/projects/${project.id}`, { headers, data: { name: `${name} updated` } })).ok()).toBe(true);
    const entries = await page.request.get(`/api/audit/activity?targetType=project&targetId=${project.id}&action=project.update`);
    expect(entries.ok()).toBe(true);
    const entry = (await entries.json()).items[0];
    await page.goto(`/audit/activity?range=90d&action=project.update&targetType=project&targetId=${project.id}&pageSize=25&sort=at&refresh=30`);
    const trigger = page.getByRole("button", { name: `View entry: Project updated, ${name} updated`, exact: true });
    await trigger.click();
    await expect(page).toHaveURL(url => url.pathname === "/audit/activity" && url.searchParams.get("entry") === entry.id);
    const dialog = page.getByRole("dialog", { name: "Project updated", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await expect(dialog).toContainText(`${name} updated`);
    const opened = new URL(page.url());
    expect(opened.searchParams.get("targetId")).toBe(project.id);
    expect(opened.searchParams.get("range")).toBe("90d");
    expect(opened.searchParams.get("pageSize")).toBe("25");
    expect(opened.searchParams.get("sort")).toBe("at");
    expect(opened.searchParams.get("refresh")).toBe("30");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(url => !url.searchParams.has("entry") && url.searchParams.get("targetId") === project.id);
    await expect(trigger).toBeFocused();
    await page.goForward();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await page.goto(`/audit/activity?range=7d&action=user.delete&entry=${entry.id.toUpperCase()}`);
    await expect(dialog).toBeVisible(); // independent lookup, outside the background list's action
    await page.reload();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL(url => !url.searchParams.has("entry") && url.searchParams.get("action") === "user.delete");
    await expect(page.getByRole("heading", { level: 1, name: "Activity log", exact: true })).toBeFocused();
  } finally { expect((await page.request.delete(`/api/projects/${project.id}`, { headers })).ok()).toBe(true); }
});

test("cold detail chunk has cancellable nonmodal feedback and late resolution never reopens it", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let delivered!: () => void;
  const delivery = new Promise<void>(resolve => { delivered = resolve; });
  let chunkSeen!: () => void;
  const seen = new Promise<void>(resolve => { chunkSeen = resolve; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    const body = await response.text();
    const detail = body.includes("Loading activity entry");
    if (detail) { chunkSeen(); await held; }
    await route.fulfill({ response, body });
    if (detail) delivered();
  });
  await page.goto("/audit/activity?range=90d");
  const trigger = page.getByRole("button", { name: /^View entry:/ }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await Promise.race([seen, page.waitForTimeout(5000).then(() => { throw Error("The detail chunk was not intercepted"); })]);
  try {
    await expect(page.getByRole("status").filter({ hasText: "Opening activity entry…" })).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-busy", "true");
    await expect(trigger).toHaveText("Opening…");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const length = await page.evaluate(() => history.length);
    await trigger.click();
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(url => !url.searchParams.has("entry"));
    await expect(trigger).toBeFocused();
  } finally { release(); }
  await delivery;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Opening activity entry…", { exact: true })).toHaveCount(0);
  await expect(trigger).not.toHaveAttribute("aria-busy", "true");
});

test("rejected cold chunk offers same-URL reload and Cancel, including direct links", async ({ page }) => {
  const list = await page.request.get("/api/audit/activity?range=90d");
  expect(list.ok()).toBe(true);
  const id = (await list.json()).items[0].id;
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes("Loading activity entry")) await route.abort("failed");
    else await route.fulfill({ response, body });
  });
  await page.goto(`/audit/activity?range=90d&entry=${id}`);
  await expect(page.getByText("Couldn't open this activity entry.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload page", exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(SCRATCH, "activity-entry-chunk-failure.png"), fullPage: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(url => !url.searchParams.has("entry") && url.searchParams.get("range") === "90d");
  await expect(page.getByRole("heading", { name: "Activity log", exact: true })).toBeFocused();
});

for (const direct of [false, true]) test(`pending A to B replaces one entry slot (${direct ? "direct" : "owned list"}) and late chunk opens only current B`, async ({ page }) => {
  const response = await page.request.get("/api/audit/activity?range=90d");
  const items = (await response.json()).items;
  const a = items[0].id, b = items[1].id;
  let release!: () => void, seen = false, delivered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const delivery = new Promise<void>(resolve => { delivered = resolve; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch(), body = await response.text(), detail = body.includes("Loading activity entry");
    if (detail) { seen = true; await held; }
    await route.fulfill({ response, body });
    if (detail) delivered();
  });
  await page.goto(`/audit/activity?range=90d${direct ? `&entry=${a}` : ""}`);
  const buttons = page.getByRole("button", { name: /^View entry:/ });
  await expect(buttons.nth(1)).toBeVisible();
  if (!direct) await buttons.nth(0).click();
  await expect.poll(() => seen).toBe(true);
  const notice = page.getByRole("status").filter({ hasText: "Opening activity entry…" });
  await expect(notice).toBeVisible();
  const surface = page.locator('[data-slot="filter-surface"]');
  expect(await notice.evaluate(node => node.parentElement?.getAttribute("data-slot"))).toBe("filter-surface");
  const rail = page.locator('[data-slot="filter-launcher"]');
  const railBox = (await rail.boundingBox())!, surfaceBox = (await surface.boundingBox())!;
  expect(Math.abs(railBox.y - surfaceBox.y)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SCRATCH, `activity-entry-chunk-pending-${direct ? "direct" : "row"}.png`), fullPage: true });
  const length = await page.evaluate(() => history.length);
  await buttons.nth(1).click();
  await expect(page).toHaveURL(url => url.searchParams.get("entry") === b);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === "/audit/activity" && !url.searchParams.has("entry"));
  await expect(buttons.nth(1)).toBeFocused();
  if (!direct) {
    await page.goForward();
    await expect(page).toHaveURL(url => url.searchParams.get("entry") === b);
  }
  release(); await delivery;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  if (!direct) {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible(); await expect(dialog).toBeFocused();
    await expect(dialog.getByText(b, { exact: true })).toBeVisible();
    await expect(dialog.getByText(a, { exact: true })).toHaveCount(0);
  } else await expect(page.getByRole("dialog")).toHaveCount(0);
});
