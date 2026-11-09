import { expect, test, type Page } from "@playwright/test";
import type { ActivityDto } from "@starterkit/shared/contracts/audit";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, csrfOf, settleAnimations } from "./helpers";
import path from "node:path";

test.use({ storageState: AUTH_STATE });
const fail = (status: number) => ({ status, contentType: "application/json", body: JSON.stringify({ error: { code: status === 403 ? "forbidden" : status === 404 ? "not_found" : "internal", message: "Controlled dependency failure." } }) });
async function seedEntry(page: Page): Promise<ActivityDto> {
  const response = await page.request.get("/api/audit/activity?range=90d");
  expect(response.ok()).toBe(true);
  return (await response.json()).items[0];
}
const navigateEntry = (page: Page, id: string) => page.evaluate(id => history.pushState(null, "", `/audit/activity?range=90d&entry=${id}`), id);

test("real project history and deleted record keep recorded evidence readable", async ({ page }) => {
  await page.goto("/projects");
  const headers = { "x-csrf-token": await csrfOf(page) }, name = `History evidence ${Date.now()}`;
  const response = await page.request.post("/api/projects", { headers, data: { name } });
  expect(response.status()).toBe(201);
  const project = await response.json();
  let deleted = false;
  try {
    await page.goto(`/projects/${project.id}`);
    const history = page.getByRole("link", { name: "View history", exact: true });
    await expect(history).toHaveAttribute("href", `/audit/activity?range=90d&targetType=project&targetId=${project.id}`);
    await history.click();
    const entry = await seedEntry(page);
    await page.getByRole("button", { name: `View entry: Project created, ${name}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Project created", exact: true });
    await expect(dialog.getByRole("link", { name: "Open project", exact: true })).toHaveAttribute("href", `/projects/${project.id}`);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    expect((await page.request.delete(`/api/projects/${project.id}`, { headers })).ok()).toBe(true); deleted = true;
    const list = await page.request.get(`/api/audit/activity?range=90d&targetType=project&targetId=${project.id}&action=project.create`);
    const retained = (await list.json()).items[0];
    expect(retained.target.label).toBe(name);
    await navigateEntry(page, retained.id);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(name);
    await expect(dialog.getByText("Record unavailable.", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Open project" })).toHaveCount(0);
    expect((await page.request.get(`/api/audit/activity/${retained.id}`)).status()).toBe(200);
    expect(entry.id).toBeTruthy();
  } finally { if (!deleted) expect((await page.request.delete(`/api/projects/${project.id}`, { headers })).ok()).toBe(true); }
});

test("invalid exact filters remain 400 through another filter; explicit clear recovers and Back restores error", async ({ page }) => {
  await page.goto("/audit/activity?range=90d&actorId=&targetType=user&targetId=");
  await expect(page.getByText("Couldn't load activity entries", { exact: true })).toBeVisible();
  await expect(page.getByText("Actor ID: Empty value", { exact: true })).toBeVisible();
  await expect(page.getByText("Target: user · Empty ID", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Expand filters/ }).click();
  await page.getByRole("textbox", { name: "Search action options", exact: true }).fill("Project created");
  await page.getByRole("checkbox", { name: "Project created", exact: true }).check();
  await page.getByRole("button", { name: "Collapse filters", exact: true }).click();
  await expect(page).toHaveURL(url => url.searchParams.has("actorId") && url.searchParams.get("actorId") === "" && url.searchParams.has("targetId"));
  const invalid = await page.request.get(`/api/audit/activity?${new URL(page.url()).searchParams}`);
  expect(invalid.status()).toBe(400);
  await page.getByRole("button", { name: "Remove filter Target: user · Empty ID", exact: true }).click();
  await expect(page).toHaveURL(url => !url.searchParams.has("targetType") && !url.searchParams.has("targetId") && url.searchParams.has("actorId"));
  await page.getByRole("button", { name: "Remove filter Actor ID: Empty value", exact: true }).click();
  await expect(page).toHaveURL(url => !url.searchParams.has("actorId"));
  await expect(page.getByText("Couldn't load activity entries", { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(url => url.searchParams.has("actorId") && url.searchParams.get("actorId") === "");
  await expect(page.getByText("Couldn't load activity entries", { exact: true })).toBeVisible();
});

test("actor investigation preserves user AND other predicates; target is one atomic chip", async ({ page }) => {
  const entry = await seedEntry(page);
  await page.goto(`/audit/activity?range=90d&user=NoSuchActor&action=project.create&pageSize=25&sort=at&page=3&refresh=30&entry=${entry.id}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "View actor activity", exact: true })).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await dialog.getByRole("button", { name: "View actor activity", exact: true }).click();
  await expect(page).toHaveURL(url => url.searchParams.get("actorId") === entry.actor.id && !url.searchParams.has("entry") && !url.searchParams.has("page"));
  const params = new URL(page.url()).searchParams;
  expect(params.get("user")).toBe("NoSuchActor"); expect(params.get("action")).toBe("project.create");
  expect(params.get("range")).toBe("90d"); expect(params.get("pageSize")).toBe("25"); expect(params.get("sort")).toBe("at"); expect(params.get("refresh")).toBe("30");
  expect(await page.evaluate(() => history.length)).toBe(length + 1);
  await expect(page.getByText("No activity entries match", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "View target activity", exact: true }).click();
  await expect(page).toHaveURL(url => url.searchParams.get("targetType") === entry.target.type && url.searchParams.get("targetId") === entry.target.id && !url.searchParams.has("entry"));
  const summary = page.locator('[data-slot="filter-active-summary"]');
  await expect(summary.locator('[data-slot="filter-chip"]').filter({ hasText: /^Target:/ })).toHaveCount(1);
  await summary.getByRole("button", { name: /^Remove filter Target:/ }).click();
  await expect(page).toHaveURL(url => !url.searchParams.has("targetType") && !url.searchParams.has("targetId") && url.searchParams.get("user") === "NoSuchActor");
});

test("controlled clipboard success and complete failure expose only canonical entry link", async ({ page }) => {
  const entry = await seedEntry(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; } } });
  });
  await page.goto(`/audit/activity?range=90d&user=private-context&entry=${entry.id.toUpperCase()}`);
  const dialog = page.getByRole("dialog"), copy = dialog.getByRole("button", { name: "Copy link", exact: true });
  await copy.click();
  await expect(dialog.getByRole("status").filter({ hasText: "Link copied." })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(new URL(`/audit/activity?entry=${entry.id}`, page.url()).href);
  await expect(copy).toBeFocused();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw Error("controlled rejection"); } } });
    document.execCommand = () => false;
  });
  await copy.click();
  await expect(dialog.getByRole("alert")).toHaveText("Couldn't copy the link. Select and copy it below.");
  const field = dialog.getByRole("textbox", { name: "Entry link", exact: true });
  await expect(field).toHaveValue(new URL(`/audit/activity?entry=${entry.id}`, page.url()).href);
  await expect(field).toHaveAttribute("readonly", ""); await expect(copy).toBeFocused();
  await page.keyboard.press("Tab"); await expect(field).toBeFocused();
  expect(new URL(page.url()).searchParams.get("user")).toBe("private-context");
});

for (const code of [403, 404, 500]) test(`controlled cached entry refetch ${code} obeys terminal/stale policy`, async ({ page }) => {
  const entry = await seedEntry(page);
  let response = 200, hits = 0;
  await page.route(`**/api/audit/activity/${entry.id}`, async route => {
    hits++;
    await route.fulfill(response === 200 ? { json: entry } : fail(response));
  });
  await page.goto("/audit/activity?range=90d"); // SSR cannot seed this entry key.
  await navigateEntry(page, entry.id);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
  response = code;
  // A public refresh control requests this module; invoke its existing handler while the modal is open to probe same-ID cache policy.
  const before = hits;
  await page.locator('button[aria-label="Refresh now"]').evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => hits).toBeGreaterThan(before);
  if (code === 500) {
    await expect(dialog).toContainText("Couldn't refresh this activity entry; showing the last loaded details.");
    await expect(dialog.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
    response = 200; await dialog.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(dialog.getByText("Couldn't refresh this activity entry; showing the last loaded details.")).toHaveCount(0);
  } else {
    await expect(dialog.getByRole("heading", { name: code === 403 ? "Access denied" : "Activity entry not found", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Copy link", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "View actor activity", exact: true })).toHaveCount(0);
    await expect(dialog.getByText(entry.id, { exact: true })).toHaveCount(0);
  }
});

test("controlled held A cannot replace B and malformed first entry never fetches a collection as detail", async ({ page }) => {
  const sample = await seedEntry(page), a = "00000000-0000-4000-8000-000000000001", b = "00000000-0000-4000-8000-000000000002";
  let release!: () => void, seen = false;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/audit/activity/${a}`, async route => { seen = true; await hold; await route.fulfill({ json: { ...sample, id: a, target: { ...sample.target, label: "Late evidence A" } } }); });
  await page.route(`**/api/audit/activity/${b}`, route => route.fulfill({ json: { ...sample, id: b, target: { ...sample.target, label: "Current evidence B" } } }));
  await page.goto("/audit/activity?range=90d");
  await navigateEntry(page, a); await expect.poll(() => seen).toBe(true);
  await navigateEntry(page, b);
  await expect(page.getByRole("dialog")).toContainText("Current evidence B");
  release();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("dialog")).not.toContainText("Late evidence A");
  const detailRequests: string[] = [];
  page.on("request", request => { if (/\/api\/audit\/activity\//.test(request.url())) detailRequests.push(request.url()); });
  await page.evaluate(b => history.pushState(null, "", `/audit/activity?entry=&entry=${b}`), b);
  await expect(page.getByRole("dialog", { name: "Activity entry not found", exact: true })).toBeVisible();
  expect(detailRequests).toEqual([]);
});

test("controlled slow past-end list cannot replace the route after leaving Activity", async ({ page }) => {
  await page.goto("/audit/activity?range=90d");
  let release!: () => void, seen = false;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/audit/activity?**", async route => {
    if (new URL(route.request().url()).searchParams.get("page") !== "1000") return route.continue();
    seen = true; await hold;
    await route.fulfill({ json: { items: [], total: 1, page: 1000, pageSize: 15, totalCapped: false } });
  });
  await page.evaluate(() => history.pushState(null, "", "/audit/activity?range=90d&page=1000"));
  await expect.poll(() => seen).toBe(true);
  await page.getByRole("link", { name: "Projects", exact: true }).first().click();
  await expect(page).toHaveURL(url => url.pathname === "/projects");
  release();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page).toHaveURL(url => url.pathname === "/projects");
});

test("activity entry visual states wrap at reference widths with keyboard and reduced motion", async ({ page }) => {
  const sample = await seedEntry(page), id = "00000000-0000-4000-8000-000000000003";
  const targetId = ` leading\n${"OpaqueCase_".repeat(44)} trailing `;
  await page.route(`**/api/audit/activity/${id}`, route => route.fulfill({ json: { ...sample, id, target: { id: targetId, type: "permission", label: "Recorded opaque identity" } } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [[360, 800], [390, 844], [834, 1112], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/audit/activity?range=90d&targetType=permission&targetId=${encodeURIComponent(targetId)}&entry=${id}`);
    const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("Recorded opaque identity");
    await expect(dialog.locator("dd").filter({ hasText: "Recorded opaque identity" })).toContainText(JSON.stringify(targetId));
    await settleAnimations(page);
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await axeSerious(page)).toEqual([]);
    await page.screenshot({ path: path.join(SCRATCH, `activity-entry-${width}-light.png`), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(SCRATCH, `activity-entry-${width}-dark.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const chip = page.locator('[data-slot="filter-chip"]').filter({ hasText: /^Target:/ });
    await expect(chip).toContainText(JSON.stringify(targetId));
    expect(await chip.locator(":scope > span").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(SCRATCH, `activity-filter-${width}.png`), fullPage: true });
  }
});

test("real CSV export loads its saver on demand and sends the exact target predicate without entry", async ({ page }) => {
  const entry = await seedEntry(page);
  const filters = new URLSearchParams({ range: "90d", targetType: entry.target.type, targetId: entry.target.id });
  await page.goto(`/audit/activity?${filters}`);
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeEnabled();
  const request = page.waitForRequest(request => new URL(request.url()).searchParams.get("format") === "csv");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const url = new URL((await request).url());
  expect(url.searchParams.get("targetType")).toBe(entry.target.type);
  expect(url.searchParams.get("targetId")).toBe(entry.target.id);
  expect(url.searchParams.has("entry")).toBe(false);
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});

test("real user history opens a clean 90-day target scope even when the recent list is empty", async ({ page }) => {
  const response = await page.request.get("/api/users?pageSize=15");
  expect(response.ok()).toBe(true);
  const user = (await response.json()).items[0];
  await page.goto(`/users/${user.id}`);
  const history = page.getByRole("link", { name: "View history", exact: true });
  await expect(history).toHaveAttribute("href", `/audit/activity?range=90d&targetType=user&targetId=${user.id}`);
  await expect(page.getByText("Activity · Last 90 days", { exact: true })).toBeVisible();
  await history.click();
  await expect(page).toHaveURL(url => url.pathname === "/audit/activity" && url.searchParams.get("targetType") === "user" && url.searchParams.get("targetId") === user.id && url.searchParams.get("range") === "90d" && !url.searchParams.has("actorId") && !url.searchParams.has("entry"));
});

test("controlled saver chunk failure leaves export recoverable without a false saved result", async ({ page }) => {
  await page.goto("/audit/activity?range=90d");
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch(), body = await response.text();
    if (body.includes("revokeObjectURL")) await route.abort("failed");
    else await route.fulfill({ response, body });
  });
  let downloads = 0;
  page.on("download", () => downloads++);
  const button = page.getByRole("button", { name: "Export CSV", exact: true });
  await expect(button).toBeEnabled(); await button.click();
  await expect(page.getByText("Couldn't export the activity entries", { exact: true })).toBeVisible();
  await expect(button).toBeEnabled();
  expect(downloads).toBe(0);
  await expect(page.getByText(/^Saved .*\.csv$/)).toHaveCount(0);
});
