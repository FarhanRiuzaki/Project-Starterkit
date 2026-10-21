import { expect, type Locator, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { csrfOf } from "./helpers";

/**
 * The interaction standards of docs/standards/ui-standard.md §5b, end to end as the seed Superadmin: a reversible
 * action answers with Undo instead of a confirmation, a list reopens as it was left, and new-password requirements
 * tick off while typing.
 */
test.use({ storageState: AUTH_STATE });

/**
 * Opens a menu from its trigger, clicking again only while the trigger says closed (`aria-expanded`): a second click on
 * an open menu would close it, and a menu still fading out after a pick can show the item for a moment. A press before the JS arrives is covered on its own below (one click, no retry). In CI a first click
 * after a reload has still opened nothing once (2026-10-21, PR #5, "Columns, 1 hidden" on the stand-in trigger, its
 * chunk requested right after); not reproduced locally in 12 tries at 1x and 4x CPU, cause unknown.
 */
async function openMenu(trigger: Locator, item: Locator) {
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(item).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

test("a press before the JS arrives acts once the page can: a toggle toggles once, a menu opens", async ({ page }) => {
  // A slow network: every script chunk arrives 1 s late, so each press below lands on the server HTML.
  await page.route("**/_next/static/chunks/**", async (r) => { await new Promise((ok) => setTimeout(ok, 1000)); await r.continue(); });
  await page.goto("/users", { waitUntil: "commit" });
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Expand sidebar" }), "toggled once, not back").toBeVisible();

  await page.goto("/users", { waitUntil: "commit" });
  await page.getByRole("button", { name: "Views", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Save view as…" })).toBeVisible({ timeout: 10_000 });
  // Opened through the stand-in: the menu's list still loads (its owner heard onOpenChange).
  await expect(page.getByText("Loading your views…")).toHaveCount(0);
});

test("deactivating one user needs no confirmation; the toast's Undo makes them active again", async ({ page }) => {
  await page.goto("/users?q=citra.17%40example.com");
  const table = page.getByRole("table");
  const row = table.getByRole("row", { name: /Citra Utama/ });
  await expect(row).toContainText("Active");
  await row.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const toast = page.getByRole("listitem").filter({ hasText: "Deactivated Citra Utama." });
  await expect(toast).toBeVisible();
  await expect(row).toContainText("Inactive");
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Activated Citra Utama.", { exact: true })).toBeVisible(); // not the "Deactivated …" toast still on screen
  await expect(row).toContainText("Active");
  await expect(row).not.toContainText("Inactive");
});

/** An href or URL as `path?sorted query`, so the order of the parameters doesn't matter. */
const norm = (href: string) => {
  const u = new URL(href, "http://x");
  return `${u.pathname}?${[...u.searchParams].map(([k, v]) => `${k}=${v}`).sort().join("&")}`;
};
const VIEW = "/users?sort=-createdAt&status=inactive";

test("a list reopens with its last filters and sort from the sidebar and the breadcrumb, not its page or search", async ({ page }) => {
  await page.goto("/users?status=inactive&sort=-createdAt&page=2&q=a");
  const menu = page.getByRole("navigation", { name: "Menu" });
  const usersLink = menu.getByRole("link", { name: "Users", exact: true });
  await expect.poll(async () => norm((await usersLink.getAttribute("href")) ?? "")).toBe(VIEW);
  await menu.getByRole("link", { name: "Roles" }).click();
  await expect(page).toHaveURL("/roles");
  await usersLink.click();
  await expect.poll(() => norm(page.url())).toBe(VIEW);
  await expect(page.getByRole("button", { name: "Status: Inactive" })).toBeVisible();
  // From a user's page the breadcrumb goes back to the same view.
  await page.getByRole("table").getByRole("link").first().click();
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Users", exact: true });
  await expect.poll(async () => norm((await crumb.getAttribute("href")) ?? "")).toBe(VIEW);
  // Back on the defaults, the link is plain again.
  await page.goto("/users");
  await expect(menu.getByRole("link", { name: "Users", exact: true })).toHaveAttribute("href", "/users");
});

test("new-password requirements are listed before typing and tick off while typing", async ({ page }) => {
  await page.goto("/me/security");
  const checks = page.locator("#pw-checks");
  await expect(checks).toContainText("At least 12 characters, not yet");
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("abcdefg");
  await expect(checks).toContainText("At least 12 characters (5 more), not yet");
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("abcdefghijkl");
  await expect(checks).toContainText("At least 12 characters, done");
  await page.getByRole("textbox", { name: "Repeat new password", exact: true }).fill("abcdefghijkl");
  await expect(checks).toContainText("The two passwords match, done");
  await expect(page.getByRole("textbox", { name: "New password", exact: true })).toHaveAttribute("aria-describedby", /pw-checks/);
});

test("? lists the keyboard shortcuts; turning single-key shortcuts off stops G then a letter", async ({ page }) => {
  await page.goto("/users");
  await page.locator("main h1").click(); // focus in the page, outside a text field
  await page.keyboard.press("Shift+Slash");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("definition").filter({ hasText: "G then R" })).toHaveCount(1);
  await sheet.getByRole("switch", { name: "Single-key shortcuts" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("r");
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/users$/);
  await page.keyboard.press("Shift+Slash");
  await expect(sheet).toBeHidden();
});

test("columns: a hidden column stays hidden after a reload until Reset to default", async ({ page }) => {
  await page.goto("/users");
  const headers = page.getByRole("table").getByRole("columnheader");
  await expect(headers.filter({ hasText: "Created" })).toHaveCount(1);
  await openMenu(page.getByRole("button", { name: "Columns", exact: true }), page.getByRole("menuitemcheckbox", { name: "Created" }));
  await page.getByRole("menuitemcheckbox", { name: "Created" }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "User" })).toBeDisabled(); // the identity column stays
  await page.keyboard.press("Escape");
  await expect(headers.filter({ hasText: "Created" })).toHaveCount(0);
  await page.reload();
  await expect(headers.filter({ hasText: "Created" })).toHaveCount(0);
  await openMenu(page.getByRole("button", { name: "Columns, 1 hidden" }), page.getByRole("menuitem", { name: "Reset to default" }));
  await page.getByRole("menuitem", { name: "Reset to default" }).click();
  await expect(headers.filter({ hasText: "Created" })).toHaveCount(1);
});

test("saved views: save the list as it is, open it from another view, delete it with Undo", async ({ page }) => {
  // A clean list of views: the Undo at the end brings the view back, so a run before this one left it there.
  const headers = { "x-csrf-token": await csrfOf(page) };
  const left = await (await page.request.get("/api/me/views?path=/users&pageSize=100")).json() as { items: { id: string }[] };
  for (const v of left.items) expect((await page.request.delete(`/api/me/views/${v.id}`, { headers })).ok()).toBe(true);
  const name = "Inactive people";
  await page.goto("/users?status=inactive");
  await openMenu(page.getByRole("button", { name: "Views", exact: true }), page.getByRole("menuitem", { name: "Save view as…" }));
  await page.getByRole("menuitem", { name: "Save view as…" }).click();
  const dialog = page.getByRole("dialog", { name: "Save view" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: `Views, ${name} open` })).toBeVisible();
  await page.goto("/users");
  await openMenu(page.getByRole("button", { name: "Views", exact: true }), page.getByRole("menuitemradio", { name }));
  await page.getByRole("menuitemradio", { name }).click();
  await expect(page).toHaveURL(/\/users\?status=inactive$/);
  await openMenu(page.getByRole("button", { name: `Views, ${name} open` }), page.getByRole("menuitem", { name: `Delete “${name}”` }));
  await page.getByRole("menuitem", { name: `Delete “${name}”` }).click();
  const toast = page.getByRole("listitem").filter({ hasText: `Deleted view “${name}”.` });
  await expect(page.getByRole("button", { name: "Views", exact: true })).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: `Views, ${name} open` })).toBeVisible();
});

test("select all: after the page, every user that matches; the bulk dialog names the total", async ({ page }) => {
  await page.goto("/users");
  await page.getByRole("checkbox", { name: /^Select all 15 on this page$/ }).first().check();
  const all = page.getByRole("button", { name: /^Select all \d+ users$/ });
  const total = (await all.textContent())!.match(/\d+/)![0];
  await all.click();
  await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText(`All ${total} selected`);
  await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page.getByRole("dialog", { name: `Deactivate ${total} users` })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Select this page only" }).click();
  await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText("15 selected");
});
