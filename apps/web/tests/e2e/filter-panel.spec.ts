import path from "node:path";
import { expect, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, csrfOf, expectNoHorizontalScroll, settleAnimations } from "./helpers";

test.use({ storageState: AUTH_STATE });
for (const width of [360, 390, 834, 1440, 1920]) for (const theme of ["light", "dark"] as const) {
  test.describe(`${width} ${theme}`, () => {
    test.use({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: width < 1280 });
    test("rail and live checkbox sidebar keep geometry and canonical URL state", async ({ page }) => {
      await page.goto("/projects?status=active&pageSize=25&sort=-createdAt");
      const layout = page.locator('[data-slot="filter-layout"]');
      const trigger = page.locator('[data-slot="filter-panel-trigger"]');
      const results = layout.locator('[data-slot="filter-results"]');
      const panel = page.getByRole("dialog", { name: "Filters", exact: true });
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(await trigger.evaluate(el => !!el.closest('header, [data-slot="toolbar"]'))).toBe(false);
      await settleAnimations(page);
      await page.screenshot({ path: path.join(SCRATCH, `rail-closed-${width}-${theme}.png`), animations: "disabled" });
      if (width >= 768) {
        const rail = page.locator('[data-slot="filter-launcher"]');
        expect((await rail.boundingBox())!.width).toBe(48);
        expect((await rail.boundingBox())!.height).toBeLessThan(200);
        expect(await rail.evaluate(el => getComputedStyle(el).position)).toBe("sticky");
      }
      const before = (await results.boundingBox())!;
      await trigger.click(); await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { name: "Filters", exact: true })).toBeFocused();
      await settleAnimations(page);
      const after = (await results.boundingBox())!;
      expect(after.width).toBeCloseTo(before.width, 1); expect(after.x).toBeCloseTo(before.x, 1);
      const box = (await panel.boundingBox())!;
      if (width >= 768) {
        expect(box.width).toBeCloseTo(320, 1); expect(box.x + box.width).toBeCloseTo(width - 16, 1);
        expect(box.y + box.height).toBeCloseTo(884, 1);
        expect(box.y).toBeCloseTo(Math.max(16, (await results.boundingBox())!.y), 1);
        await expect(panel).not.toHaveAttribute("aria-modal", "true");
        await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
      } else { expect(box.width).toBeCloseTo(width, 1); await expect(panel).toHaveAttribute("aria-modal", "true"); }
      await expect(panel.getByRole("button", { name: /Apply/ })).toHaveCount(0);
      await expect(panel.getByRole("radio")).toHaveCount(0);
      const active = panel.getByRole("checkbox", { name: "Active", exact: true });
      const archived = panel.getByRole("checkbox", { name: "Archived", exact: true });
      await expect(active).toBeChecked(); await archived.click();
      await expect.poll(() => new URL(page.url()).searchParams.getAll("status")).toEqual(["active", "archived"]);
      await expect(panel).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-label", "Expand filters, 2 active selections");
      await expect(results.locator('button[aria-label="Remove filter Status: Archived"]')).toBeAttached();
      await page.screenshot({ path: path.join(SCRATCH, `rail-checked-${width}-${theme}.png`), animations: "disabled" });
      const search = panel.getByRole("textbox", { name: "Search projects", exact: true });
      await search.fill("Apollo");
      const history = await page.evaluate(() => window.history.length);
      await active.click(); // pending search and checkbox are one atomic push
      await expect.poll(() => new URL(page.url()).searchParams.getAll("status")).toEqual(["archived"]);
      await expect(page).toHaveURL(/q=Apollo/);
      expect(await page.evaluate(() => window.history.length)).toBe(history + 1);
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: /^Status/ }).click();
      await expect(archived).toBeHidden();
      await page.screenshot({ path: path.join(SCRATCH, `rail-${width}-${theme}.png`), animations: "disabled" });
      expect(await axeSerious(page)).toEqual([]);
      await search.fill("Pending text");
      await panel.getByRole("button", { name: "Clear all", exact: true }).click();
      await expect(search).toHaveValue("");
      await page.waitForTimeout(400); // prove the cancelled debounce cannot restore pending text
      await expect(page).not.toHaveURL(/q=|status=/);
      await expect(page).toHaveURL(/pageSize=25/);
      await expect(page).toHaveURL(/sort=-createdAt/);
      await page.keyboard.press("Escape"); await expect(panel).toBeHidden(); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(panel.getByRole("button", { name: /^Status/ })).toHaveAttribute("aria-expanded", "false");
      await expectNoHorizontalScroll(page);
    });
  });
}

test("desktop outside focus and clicks remain usable; all consumers have live categories", async ({ page }) => {
  for (const route of ["/users", "/projects", "/roles", "/permissions", "/audit/activity", "/audit/auth", "/ds"]) {
    await page.goto(route);
    if (route === "/ds") await page.locator('[data-slot="filter-results"]').first().scrollIntoViewIfNeeded();
    const trigger = page.locator('[data-slot="filter-panel-trigger"]').first();
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: /Apply/ })).toHaveCount(0);
    await page.locator('[data-shell-header]').getByRole("button").first().focus();
    await expect(panel).toBeHidden();
    expect(await trigger.evaluate(el => document.activeElement === el)).toBe(false);
  }
});

test("rail and portal follow the first content below PageHeader on time routes, scrolling and resizing", async ({ page }) => {
  for (const route of ["/projects", "/audit/activity"]) for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto(route);
    await settleAnimations(page);
    const rail = page.locator('[data-slot="filter-launcher"]');
    const panel = page.getByRole("dialog", { name: "Filters", exact: true });
    const checkAnchor = async (target: typeof rail) => {
      const top = await page.locator('[data-slot="filter-results"]').evaluate(el => el.getBoundingClientRect().top);
      await expect.poll(async () => (await target.boundingBox())!.y).toBeCloseTo(Math.max(16, top), 1);
    };
    for (const width of [834, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await checkAnchor(rail);
      await page.locator('[data-slot="filter-panel-trigger"]').click();
      await expect(panel).toBeVisible(); await checkAnchor(panel);
      const heading = panel.getByRole("heading", { name: "Filters", exact: true });
      await expect(heading).toBeFocused();
      // A tall real result list makes the non-sticky desktop header leave the viewport.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await checkAnchor(panel); await expect(heading).toBeFocused();
      await page.keyboard.press("Escape"); await expect(panel).toBeHidden(); await checkAnchor(rail);
      await page.evaluate(() => window.scrollTo(0, 0)); await checkAnchor(rail);
    }
  }
});

test("semantic resizing keeps the open sidebar, focus and typed search", async ({ page }) => {
  await page.goto("/projects"); await page.locator('[data-slot="filter-panel-trigger"]').click();
  const search = page.getByRole("textbox", { name: "Search projects", exact: true });
  await search.fill("Resize draft");
  for (const width of [834, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(search).toBeFocused(); await expect(search).toHaveValue("Resize draft");
    await expect(page.getByRole("dialog", { name: "Filters", exact: true })).toBeVisible();
  }
});

test("late list responses cannot restore cleared or Back-adopted search and choices", async ({ page }) => {
  for (const change of ["clear", "back"] as const) {
    await page.goto("/projects?status=active");
    const term = change === "clear" ? "Apollo" : "Toba";
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    let completed = false;
    await page.route("**/api/projects?**", async route => {
      const params = new URL(route.request().url()).searchParams;
      if (params.get("q") !== term || params.getAll("status").length !== 2) return route.continue();
      requested = true;
      const response = await route.fetch();
      await held; await route.fulfill({ response }); completed = true;
    });
    try {
      await page.locator('[data-slot="filter-panel-trigger"]').click();
      const panel = page.getByRole("dialog", { name: "Filters", exact: true });
      const search = panel.getByRole("textbox", { name: "Search projects", exact: true });
      await search.fill(term);
      await search.press("Enter"); // search replaces this entry; the checkbox pushes the next one
      await expect(page).toHaveURL(new RegExp(`q=${term}`));
      await panel.getByRole("checkbox", { name: "Archived", exact: true }).click();
      await expect.poll(() => requested).toBe(true);
      if (change === "clear") await panel.getByRole("button", { name: "Clear all", exact: true }).click();
      else await page.goBack();
      release(); await expect.poll(() => completed).toBe(true);
      await expect(search).toHaveValue(change === "clear" ? "" : term);
      if (change === "clear") await expect(page).not.toHaveURL(/q=/);
      else await expect(page).toHaveURL(new RegExp(`q=${term}`));
      expect(new URL(page.url()).searchParams.getAll("status")).toEqual(change === "clear" ? [] : ["active"]);
      await expect(panel).toBeVisible();
    } finally { release(); await page.unroute("**/api/projects?**"); }
  }
});

test("long selections clear the remembered view, preserve a named view and block overlong saves honestly", async ({ page }) => {
  await page.goto("/users?status=inactive");
  await expect(page.getByRole("button", { name: "Expand filters, 1 active selections", exact: true })).toBeVisible();
  const roles = Array.from({ length: 12 }, (_, i) => `Unknown role ${i} ${"x".repeat(28)}`);
  const query = new URLSearchParams(); roles.forEach(role => query.append("role", role));
  await page.goto(`/users?${query}`);
  await expect(page.getByText(/too long to remember in navigation/)).toBeVisible();
  await expect.poll(async () => {
    const cookie = (await page.context().cookies()).find(item => item.name === "sk_prefs");
    return cookie ? new URLSearchParams(decodeURIComponent(cookie.value)).get("view:/users") : null;
  }).toBeNull();
  const name = `Multi view ${Date.now()}`;
  await page.getByRole("button", { name: "Views", exact: true }).click();
  await page.getByRole("menuitem", { name: "Save view as…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save view", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  const saved = page.waitForResponse(response => response.url().endsWith("/api/me/views") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  const view = await (await saved).json();
  expect(new URLSearchParams(view.query).getAll("role")).toEqual(roles.sort());
  await expect(dialog).toBeHidden();
  await page.goto("/users");
  await page.getByRole("button", { name: "Views", exact: true }).click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll("role")).toEqual(roles);
  const csrf = await csrfOf(page);
  expect((await page.request.delete(`/api/me/views/${view.id}`, { headers: { "x-csrf-token": csrf } })).ok()).toBe(true);
  const tooLong = new URLSearchParams();
  for (let n = 0; n < 12; n++) tooLong.append("role", `${"長".repeat(40)}${n}`);
  await page.goto(`/users?${tooLong}`);
  await page.getByRole("button", { name: "Views", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Save view as…", exact: true })).toHaveAttribute("data-disabled");
  await expect(page.getByText("This view is too long to save. Remove some selections, then try again. The current URL still works.")).toBeVisible();
});

for (const width of [834, 1440, 1920]) for (const theme of ["light", "dark"] as const) {
  test(`Permissions PageHeader actions stay uncovered ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme });
    await page.goto("/permissions"); await settleAnimations(page);
    const rail = page.locator('[data-slot="filter-launcher"]');
    const results = page.locator('[data-slot="filter-results"]');
    const header = page.locator('[data-slot="page-header"]');
    await expect.poll(async () => (await rail.boundingBox())!.y - (await results.boundingBox())!.y).toBeCloseTo(0, 1);
    await page.screenshot({ path: path.join(SCRATCH, `permissions-rail-closed-${width}-${theme}.png`), animations: "disabled" });
    await rail.getByRole("button", { name: "Expand filters", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual((await header.boundingBox())!.y + (await header.boundingBox())!.height);
    await page.screenshot({ path: path.join(SCRATCH, `permissions-rail-open-${width}-${theme}.png`), animations: "disabled" });
    await header.getByRole("button", { name: "Add permissions", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Add permissions", exact: true })).toBeVisible();
    await expect(panel).toBeHidden();
    await page.keyboard.press("Escape");
  });
}

test("a Notice before the result is the anchor; short rails scroll only when explicitly opened", async ({ page }) => {
  const query = new URLSearchParams(); for (let n = 0; n < 12; n++) query.append("role", `Unknown ${n} ${"x".repeat(28)}`);
  await page.goto(`/users?${query}`); await settleAnimations(page);
  const notice = page.getByText(/too long to remember in navigation/).locator("..");
  const rail = page.locator('[data-slot="filter-launcher"]');
  await expect.poll(async () => (await rail.boundingBox())!.y - (await notice.boundingBox())!.y).toBeCloseTo(0, 1);
  for (const height of [400, 260]) {
    await page.setViewportSize({ width: 1440, height }); await page.goto("/permissions"); await settleAnimations(page);
    const result = page.locator('[data-slot="filter-results"]');
    const before = (await result.boundingBox())!;
    if (height === 260) { expect((await rail.boundingBox())!.height).toBe(44); }
    await rail.getByRole("button").click();
    const panel = page.getByRole("dialog", { name: "Filters", exact: true });
    await expect(panel.getByRole("heading", { name: "Filters", exact: true })).toBeFocused();
    await settleAnimations(page);
    await expect(panel.getByRole("heading", { name: "Filters", exact: true })).toBeFocused();
    const after = (await result.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.y + await page.evaluate(() => window.scrollY)).toBeCloseTo(before.y, 1);
    if (height === 400) expect(await page.evaluate(() => window.scrollY)).toBe(0);
    else expect((await panel.boundingBox())!.y).toBeCloseTo(16, 1);
    await expect(panel.getByRole("button", { name: "Collapse filters", exact: true })).toBeInViewport();
    await page.keyboard.press("Escape");
  }
});

test("audit search replaces history and its next checkbox flush pushes once", async ({ page }) => {
  await page.goto("/audit/activity"); await page.locator('[data-slot="filter-panel-trigger"]').click();
  const panel = page.getByRole("dialog", { name: "Filters", exact: true });
  const search = panel.getByRole("textbox", { name: "Search by user", exact: true });
  const history = await page.evaluate(() => window.history.length);
  await search.fill("Super"); await expect(page).toHaveURL(/user=Super/);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await search.fill("Admin"); await panel.getByRole("checkbox").first().click();
  await expect(page).toHaveURL(/user=Admin/); await expect(page).toHaveURL(/action=/);
  expect(await page.evaluate(() => window.history.length)).toBe(history + 1);
});
