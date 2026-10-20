import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";

/**
 * The interaction standards of docs/standards/ui-standard.md §5b, end to end as the seed Superadmin: a reversible
 * action answers with Undo instead of a confirmation, a list reopens as it was left, and new-password requirements
 * tick off while typing.
 */
test.use({ storageState: AUTH_STATE });

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
  await expect(page.getByText("Activated Citra Utama.")).toBeVisible();
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
  await page.getByLabel("New password", { exact: true }).fill("abcdefg");
  await expect(checks).toContainText("At least 12 characters (5 more), not yet");
  await page.getByLabel("New password", { exact: true }).fill("abcdefghijkl");
  await expect(checks).toContainText("At least 12 characters, done");
  await page.getByLabel("Repeat new password", { exact: true }).fill("abcdefghijkl");
  await expect(checks).toContainText("The two passwords match, done");
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute("aria-describedby", /pw-checks/);
});
