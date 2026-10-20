import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { axeSerious, csrfOf, demoIds, expectNoHorizontalScroll, settleAnimations, signIn, withIds } from "./helpers";

/**
 * Data surfaces per width (responsive spec "Pola per komponen"): on the phone (mobile project) every server table is
 * a list of cards with a "Sort by" select, compact pagination and a "Filters" sheet, selection and row actions work
 * by touch, the matrix scrolls inside its card with its header and module column held, charts answer a tap; on the
 * tablet and desktop the table is the table it was. Paging, sort and filters keep their URL state (Back undoes them).
 */
test.use({ storageState: AUTH_STATE });

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** Every server table: route, table name. */
const TABLES = [
  ["/users", "Users"], ["/roles", "Roles"], ["/permissions", "Permissions"], ["/audit/activity", "Activity log"],
  ["/audit/auth", "Sign-in log"], ["/me/sessions", "My sessions"], ["/users/{superadmin}", "Active sessions"],
] as const;

const firstRowKey = (page: Page, table: string) => page.getByRole("table", { name: table }).getByRole("row").first().locator('[data-mobile="title"]').innerText();

test.describe("phone: stacked rows", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  for (const [path, name] of TABLES) {
    test(`${path}: ${name} rows are cards (title, label–value lines), the table keeps its rows and cells, nothing scrolls sideways`, async ({ page, baseURL }) => {
      await open(page, await withIds(path, baseURL));
      const table = page.getByRole("table", { name });
      await expect(table.locator("thead")).toBeHidden();
      const row = table.getByRole("row").first();
      await expect(row).toBeVisible();
      expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe("grid");
      await expect(row.locator('[data-mobile="title"]')).toBeVisible();
      const vw = page.viewportSize()!.width;
      const box = (await row.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vw);
      // Each meta line starts with its column's header.
      const meta = row.locator('[data-mobile="meta"]');
      if (await meta.count()) await expect(meta.first().locator("span").first()).toBeVisible();
      // Table semantics survive the card layout: the rows and their cells are still exposed as such.
      expect(await table.getByRole("row").count()).toBeGreaterThan(0);
      expect(await row.getByRole("cell").count()).toBeGreaterThan(1);
      expect(await table.locator('xpath=ancestor::div[@data-slot="table-container"]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expectNoHorizontalScroll(page);
    });
  }

  test("users: Sort by is a request in the URL; Back undoes it", async ({ page }) => {
    await open(page, "/users");
    const sort = page.getByLabel("Sort by");
    await expect(sort).toHaveValue("name:asc");
    await sort.selectOption("lastLoginAt:desc");
    await expect(page).toHaveURL(/sort=-lastLoginAt/);
    await expect(sort).toHaveValue("lastLoginAt:desc");
    await page.goBack();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(sort).toHaveValue("name:asc");
  });

  test("users: compact pagination (previous / page x of y / next) and the page size keep the URL state", async ({ page }) => {
    await open(page, "/users");
    const pager = page.getByRole("navigation", { name: "Users pages" });
    await expect(pager.getByText(/^Page 1 of \d+$/)).toBeVisible();
    for (const hidden of ["First page", "Last page", "Page 2"]) await expect(pager.getByRole("button", { name: hidden, exact: true })).toBeHidden();
    const first = await firstRowKey(page, "Users");
    await pager.getByRole("button", { name: "Next page" }).tap();
    await expect(page).toHaveURL(/page=2/);
    await expect(pager.getByText(/^Page 2 of \d+$/)).toBeVisible();
    await expect.poll(() => firstRowKey(page, "Users")).not.toBe(first);
    await pager.getByRole("button", { name: "Previous page" }).tap();
    await expect(page).not.toHaveURL(/page=2/);
    await page.goBack();
    await expect(page).toHaveURL(/page=2/);
    await pager.getByLabel("Rows per page").selectOption("25");
    await expect(page).toHaveURL(/pageSize=25/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByRole("table", { name: "Users" }).getByRole("row")).toHaveCount(25);
  });

  test("users: filters sit in a Filters sheet with the active count; the search stays in the row", async ({ page }) => {
    await open(page, "/users");
    await expect(page.getByRole("textbox", { name: "Search users" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Status:/ })).toBeHidden();
    await page.getByRole("button", { name: "Filters", exact: true }).tap();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(sheet).toBeVisible();
    await settleAnimations(page);
    const box = (await sheet.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.y + box.height, "a bottom sheet").toBeCloseTo(vp.height, 0);
    await sheet.getByLabel("Status").selectOption("inactive");
    await expect(page).toHaveURL(/status=inactive/);
    await sheet.getByRole("button", { name: "Show results" }).tap();
    await expect(sheet).toBeHidden();
    const button = page.getByRole("button", { name: "Filters, 1 active" });
    await expect(button).toBeVisible();
    await expect(page.getByRole("table", { name: "Users" }).getByRole("row").first()).toContainText("Inactive");
    await button.tap();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Clear filters" }).tap();
    await expect(page).not.toHaveURL(/status=/);
    await page.goBack();
    await expect(page).toHaveURL(/status=inactive/);
  });

  test("permissions and the activity log: their filters live in the sheet too", async ({ page }) => {
    await open(page, "/permissions");
    await page.getByRole("button", { name: "Filters", exact: true }).tap();
    await page.getByRole("dialog", { name: "Filters" }).getByLabel("Module").selectOption({ label: "Audit" });
    await expect(page).toHaveURL(/module=audit/);
    await page.getByRole("button", { name: "Show results" }).tap();
    await expect(page.getByRole("button", { name: "Filters, 1 active" })).toBeVisible();

    await open(page, "/audit/activity");
    await page.getByRole("button", { name: "Filters", exact: true }).tap();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(sheet.getByLabel("From")).toBeVisible();
    await sheet.getByLabel("Action").selectOption({ index: 1 });
    await expect(page).toHaveURL(/action=/);
  });

  test("users: rows are selected by touch; with a selection the bulk bar stays in reach under the top bar", async ({ page }) => {
    await open(page, "/users");
    const table = page.getByRole("table", { name: "Users" });
    // The checkbox's label is its 44 px hit area.
    await table.locator('[data-mobile="lead"] label').nth(1).tap();
    await table.locator('[data-mobile="lead"] label').nth(2).tap();
    const bar = page.getByRole("region", { name: "Bulk actions" });
    await expect(bar).toContainText("2 selected");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bar).toBeInViewport();
    const top = (await page.locator('[data-print="hide"]:has(> [data-slot="drawer-trigger"])').boundingBox())!;
    expect((await bar.boundingBox())!.y, "under the top bar, not over it").toBeGreaterThanOrEqual(top.y + top.height - 1);
    await bar.getByRole("button", { name: "Deactivate" }).tap();
    await expect(page.getByRole("dialog", { name: "Deactivate 2 users" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("users: a card's Actions menu holds Deactivate with its reason (own account), the row button is off the card", async ({ page }) => {
    await open(page, "/users?q=superadmin%40example.com");
    const table = page.getByRole("table", { name: "Users" });
    await expect(table.getByRole("row")).toHaveCount(1);
    await expect(table.getByRole("button", { name: "Deactivate", exact: true })).toBeHidden();
    await table.getByRole("button", { name: /^Actions for / }).tap();
    const item = page.getByRole("menuitem", { name: /Deactivate user/ });
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("aria-disabled", "true");
    await expect(item).toContainText("You can't do this to your own account.");
  });

  test("users: Activate from a card's menu keeps a pending state on the card while it runs", async ({ page }) => {
    await open(page, "/users?q=inactive%40example.com");
    const id = (await page.getByRole("table", { name: "Users" }).getByRole("link", { name: "Inactive User" }).getAttribute("href"))!.split("/").pop()!;
    const token = await csrfOf(page);
    await page.route("**/api/users/*/status", async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
    try {
      await page.getByRole("button", { name: "Actions for Inactive User" }).tap();
      await page.getByRole("menuitem", { name: "Activate user" }).tap();
      const busy = page.getByRole("table", { name: "Users" }).locator('button[aria-busy="true"]');
      await expect(busy, "the card's Activate button, with its spinner").toBeVisible();
      await expect(busy).toContainText("Activate");
      await expect(page.getByText("Activated Inactive User.")).toBeVisible();
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.request.post(`/api/users/${id}/status`, { headers: { "x-csrf-token": token }, data: { active: false } });
    }
  });

  test("roles: Sort by, a card's menu opens the role", async ({ page }) => {
    await open(page, "/roles");
    await page.getByLabel("Sort by").selectOption("users:desc");
    await expect(page).toHaveURL(/sort=-users/);
    await page.getByRole("table", { name: "Roles" }).getByRole("button", { name: /^Actions for / }).first().tap();
    await page.getByRole("menuitem", { name: "View role" }).tap();
    await expect(page).toHaveURL(/\/roles\/[^/]+$/);
  });

  test("the matrix scrolls inside its card with the header row and module column held, 44 px rows", async ({ page, baseURL }) => {
    await open(page, await withIds("/roles/{adminRole}", baseURL));
    const grid = page.getByRole("grid", { name: /^Permissions of / });
    const box = grid.locator("xpath=..");
    expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth), "wider than the phone: it scrolls in its box").toBe(true);
    const moduleCell = grid.getByRole("rowheader").first();
    const left = (await moduleCell.boundingBox())!.x;
    await box.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    expect((await moduleCell.boundingBox())!.x, "the module column stays").toBeCloseTo(left, 0);
    await expect(moduleCell).toBeInViewport();
    expect(await grid.locator("thead th").first().evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    expect((await grid.getByRole("row").nth(1).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
  });

  test("the matrix: a tap on a read-only cell shows why", async ({ page }) => {
    await open(page, "/ds");
    const grid = page.getByRole("grid", { name: "Permissions of Sample role" });
    await grid.scrollIntoViewIfNeeded();
    await grid.getByRole("checkbox", { name: "Delete role" }).tap();
    await expect(page.getByRole("status").filter({ hasText: "Delete role: Your role doesn't hold this permission" })).toBeVisible();
  });

  test("dashboard chart: fewer x ticks than days, and a tap shows the tooltip", async ({ page }) => {
    await open(page, "/");
    const chart = page.getByRole("figure", { name: "Sign-ins per day" });
    await chart.scrollIntoViewIfNeeded();
    const svg = chart.locator("svg.recharts-surface");
    await expect(svg).toBeVisible();
    const ticks = await chart.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count();
    expect(ticks).toBeGreaterThan(1);
    expect(ticks, "labels thin out on a phone").toBeLessThan(14);
    const b = (await svg.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width * 0.6, b.y + b.height * 0.5);
    await expect(chart.locator(".recharts-tooltip-wrapper")).toBeVisible();
    await expect(chart.locator(".recharts-tooltip-wrapper")).toContainText(/Successful/);
  });

  test("tabs scroll inside the tablist; the indicator follows the tapped tab", async ({ page }) => {
    await open(page, "/ds");
    const list = page.getByRole("tablist", { name: "Sample sections" });
    await list.scrollIntoViewIfNeeded();
    expect(await list.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    const tab = list.getByRole("tab", { name: "Security" });
    await tab.tap();
    await expect(tab).toHaveAttribute("data-state", "active");
    await settleAnimations(page);
    const t = (await tab.boundingBox())!;
    const ind = (await list.locator('[data-slot="tabs-indicator"], [role=tab][data-state=active] > .h-0\\.5').first().boundingBox())!;
    expect(ind.x).toBeCloseTo(t.x, 0);
    expect(ind.width).toBeCloseTo(t.width, 0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`axe with the Filters sheet open (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await open(page, "/users");
      await page.getByRole("button", { name: "Filters", exact: true }).tap();
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
      expect(await axeSerious(page)).toEqual([]);
    });
  }
});

test.describe("phone: touch path for a reason without user.delete", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a role with user.edit but not user.delete still reads why Deactivate is off on its own card", async ({ browser, page }) => {
    const su = await browser.newContext({ storageState: AUTH_STATE });
    const sp = await su.newPage();
    const token = await csrfOf(sp);
    const name = `Editors ${Date.now() % 100_000}`;
    const created = await sp.request.post("/api/roles", { headers: { "x-csrf-token": token }, data: { name, permissions: ["user.view", "user.edit"] } });
    expect(created.status()).toBe(201);
    const role = (await created.json()) as { id: string };
    const admin = (await (await sp.request.get("/api/users?q=admin%40example.com")).json()) as { items: { id: string }[] };
    const adminId = admin.items[0]!.id;
    expect((await sp.request.patch(`/api/users/${adminId}`, { headers: { "x-csrf-token": token }, data: { roles: [name] } })).status()).toBe(200);
    try {
      await signIn(page, "admin");
      await expect(page).toHaveURL("/");
      await open(page, "/users?q=admin%40example.com");
      await page.getByRole("button", { name: "Actions for Admin User" }).tap();
      await expect(page.getByRole("menuitem", { name: /Delete user/ })).toHaveCount(0);
      const item = page.getByRole("menuitem", { name: /Deactivate user/ });
      await expect(item).toBeVisible();
      await expect(item).toContainText("You can't do this to your own account.");
    } finally {
      await sp.request.patch(`/api/users/${adminId}`, { headers: { "x-csrf-token": token }, data: { roles: ["Admin"] } });
      await sp.request.delete(`/api/roles/${role.id}`, { headers: { "x-csrf-token": token } });
      await su.close();
    }
  });
});

test.describe("tablet and desktop: the table stays a table", () => {
  test.skip(({ isMobile }) => isMobile, "tablet and desktop");

  test("users: header row and sortable headers, full pagination, inline filters; no Sort by, no Filters button", async ({ page }) => {
    await open(page, "/users");
    const table = page.getByRole("table", { name: "Users" });
    await expect(table.locator("thead")).toBeVisible();
    expect(await table.getByRole("row").nth(1).evaluate((el) => getComputedStyle(el).display)).toBe("table-row");
    await expect(page.getByLabel("Sort by")).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: /^Status:/ })).toBeVisible();
    const pager = page.getByRole("navigation", { name: "Users pages" });
    await expect(pager.getByRole("button", { name: "Page 2", exact: true })).toBeVisible();
    await expect(pager.getByText(/^Page 1 of/)).toBeHidden();
    // Below 1280 the row's Deactivate / Activate is a menu item (the table fits); from 1280 it is a row button.
    if (test.info().project.name === "tablet") {
      await expect(table.getByRole("button", { name: "Deactivate", exact: true }).first()).toBeHidden();
      await table.getByRole("button", { name: /^Actions for / }).first().click();
      await expect(page.getByRole("menuitem", { name: /Deactivate user/ })).toBeVisible();
    } else {
      await expect(table.getByRole("button", { name: "Deactivate", exact: true }).first()).toBeVisible();
    }
  });

  test("identity columns keep their text: names are not cut to a letter, and the users table fits its card", async ({ page, baseURL }) => {
    const sessions = `/users/${(await demoIds(baseURL)).superadmin}`;
    for (const [path, name] of [["/users", "Users"], ["/roles", "Roles"], ["/permissions", "Permissions"], ["/me/sessions", "My sessions"], [sessions, "Active sessions"]] as const) {
      await open(page, path);
      const cut = await page.getByRole("table", { name }).locator('[data-mobile="title"]').evaluateAll((cells) =>
        // The name itself; a secondary caption line (an email under the name) may truncate with its title.
        cells.flatMap((c) => [...c.querySelectorAll<HTMLElement>("*")].filter((el) => !el.closest(".text-caption") && el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent ?? "")));
      expect(cut, `${path}: truncated identity text`).toEqual([]);
      await expectNoHorizontalScroll(page);
    }
    await open(page, "/users");
    const box = await page.locator('[data-slot="table-container"]').first().evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth,
      cols: [...el.querySelectorAll("thead th")].map((th) => `${th.textContent}:${Math.round(th.getBoundingClientRect().width)}`).join(" ") }));
    expect(box.sw, `the users table fits without sideways scroll (${box.cols})`).toBeLessThanOrEqual(box.cw);
  });

  test("the matrix fits and has no phone rule on the module column", async ({ page, baseURL }) => {
    await open(page, await withIds("/roles/{adminRole}", baseURL));
    const cell = page.getByRole("grid", { name: /^Permissions of / }).getByRole("rowheader").first();
    expect(await cell.evaluate((el) => getComputedStyle(el).borderRightWidth)).toBe("0px");
  });

  test("a touch screen at 1280 px and up has no menu button (the full sidebar is there)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: AUTH_STATE, viewport: { width: 1440, height: 900 }, hasTouch: true });
    const page = await ctx.newPage();
    await open(page, "/users");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
    await ctx.close();
  });
});
