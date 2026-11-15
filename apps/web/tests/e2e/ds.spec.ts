import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll } from "./helpers";

/**
 * The design system pages, light and dark: screenshot baselines (in ds.spec.ts-snapshots/, made with
 * `--update-snapshots` and reviewed by eye), axe, and no horizontal scroll at the 1280 px minimum. Deterministic: the
 * fixtures carry fixed times, reduced motion and `animations: "disabled"` stop every animation, and every lazy region
 * is mounted before the shot. The vendored affectUI group that closes a page (animated, upstream's own look) is masked
 * in the shot and skipped by axe (helpers.ts axeSerious); /ds/visuals holds nothing else, so it has no baseline.
 * The last two cases drive BreakdownCard (/ds/data) and SetupChecklist (/ds/feedback) on the desktop and the phone.
 */
test.setTimeout(90_000);
test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

/** `id` names the baseline (`ds-<id>-<scheme>-<project>-<platform>.png`); `title` is the page's h1. */
const PAGES = [
  { id: "overview", path: "/ds", title: "Design system" },
  { id: "foundations", path: "/ds/foundations", title: "Foundations" },
  { id: "components", path: "/ds/components", title: "Components" },
  { id: "forms", path: "/ds/forms", title: "Forms" },
  { id: "feedback", path: "/ds/feedback", title: "Feedback" },
  { id: "data", path: "/ds/data", title: "Data display" },
  { id: "motion", path: "/ds/motion", title: "Motion" },
] as const;
const VISUALS = { id: "visuals", path: "/ds/visuals", title: "Illustrations" } as const;

/** Opens a page and scrolls through it so every LazyMount region mounts (otherwise the height depends on the scroll position). */
async function mountAll(page: Page, p: { path: string; title: string }) {
  await page.goto(p.path);
  await expect(page.getByRole("heading", { level: 1, name: p.title, exact: true })).toBeVisible();
  // The body arrives after hydration, in its own chunk.
  await expect(page.locator('[data-slot="body-loading"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
    window.scrollTo(0, 0);
  });
  // Everything has loaded; the "Loading sample" table is busy on purpose (it shows the loading state).
  await expect(page.locator('[aria-busy="true"]:not([aria-label="Loading sample"]):not([data-affect-group] *)')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    for (const p of PAGES) {
      test(`${p.path} screenshot matches the ${colorScheme} baseline`, async ({ page }, testInfo) => {
        await mountAll(page, p);
        await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
        await page.mouse.move(1, 1);
        // The page itself, not the shell around it (the account row differs per signed-in user).
        // CSS pixels (`scale: "css"`): the phone baseline (3× screen) stays the size of the page, as the desktop one.
        // The sticky top bar is hidden for the shot: it would be drawn over the page wherever the capture had scrolled to.
        const hideTopBar = await page.addStyleTag({ content: "[data-shell-header] { visibility: hidden !important; }" });
        await expect(page.locator("#content > div").first()).toHaveScreenshot(`ds-${p.id}-${colorScheme}.png`,
          { animations: "disabled", maxDiffPixelRatio: 0.002, scale: "css", mask: [page.locator("[data-affect-group]")] });
        await hideTopBar.evaluate((el) => (el as Element).remove());
        if (p.id !== "data") return;
        // A viewport capture keeps the changed filter example readable beside the very tall page baseline.
        await page.locator('[data-slot="filter-layout"]').first().evaluate(element => {
          const header = document.querySelector<HTMLElement>('[data-shell-header]');
          const offset = window.innerWidth < 768 ? (header?.offsetHeight ?? 0) + 16 : 48;
          window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - offset, behavior: "instant" });
        });
        await page.screenshot({ path: path.join(SCRATCH, `gallery-filter-${testInfo.project.name}-${colorScheme}.png`), animations: "disabled", scale: "css" });
      });

      test(`${p.path}: no serious axe violations`, async ({ page }) => {
        await mountAll(page, p);
        expect(await axeSerious(page)).toEqual([]);
      });
    }
  });
}

test("no horizontal scroll at the 1280 px desktop minimum", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop width");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const p of [...PAGES, VISUALS]) {
    await mountAll(page, p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), p.path).toBe(0);
  }
});

/** Opens a page and waits for its body chunk. */
async function openBody(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[data-slot="body-loading"]')).toHaveCount(0);
}

test("breakdown card: ranked rows, the folded row, a clipped label by keyboard, and the five states", async ({ page }) => {
  await openBody(page, "/ds/data");
  const cardOf = (title: string) => page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) }).last();
  const signIns = cardOf("Sign-ins by method");
  const rows = signIns.getByRole("list", { name: "Sign-ins by method", exact: true }).getByRole("listitem");
  await signIns.scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText("Password");
  await expect(rows.first()).toContainText("812");
  // The total (NumberTween renders it once for the eye and once for a screen reader).
  const total = signIns.locator('[data-slot="breakdown-card"] p').first();
  await expect(total).toContainText("1,284");
  await expect(total).toContainText("sign-ins");
  // The shares are text and sum to 100.
  const shares = await rows.evaluateAll((items) => items.map((li) => Number(/^(\d+)%$/.exec(li.lastElementChild?.textContent ?? "")?.[1])));
  expect(shares.reduce((a, b) => a + b, 0)).toBe(100);

  // New data: Google passes Password, a fifth part arrives, the total follows.
  await page.getByRole("button", { name: "Change sample data", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("Google");
  await expect(total).toContainText("1,570");

  // Seven parts under max 4: three named rows, then the folded one, last.
  const roles = cardOf("Users by role").getByRole("list", { name: "Users by role", exact: true }).getByRole("listitem");
  await expect(roles).toHaveCount(4);
  await expect(roles.last()).toContainText("Other roles");
  await expect(roles.last()).toContainText("47");
  // The label that doesn't fit is a tab stop; focus shows the whole label.
  const clipped = roles.nth(1).locator('[tabindex="0"]');
  await expect(clipped).toHaveCount(1);
  await clipped.focus();
  await expect(page.getByRole("tooltip")).toContainText("Auditor with read access to every activity log and sign-in log");
  await page.keyboard.press("Escape");

  // States, by keyboard on the radiogroup (arrow keys move and choose): data → loading → empty → error → stale.
  const states = page.getByRole("radiogroup", { name: "Preview breakdown state", exact: true });
  await states.getByRole("radio", { name: "data", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(states.getByRole("radio", { name: "loading", exact: true })).toBeChecked();
  await expect(signIns.locator('[data-slot="skeleton"]').first()).toBeVisible();
  await expect(rows).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(signIns.getByText("No sign-ins in this time range", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(signIns.getByRole("alert")).toContainText("The sign-in log did not answer. Try again in a moment.");
  await page.keyboard.press("ArrowRight");
  await expect(signIns.getByRole("status")).toContainText("Showing data from 14:02. Try refreshing.");
  await expect(rows).toHaveCount(5);
  // Error again, then "Try again" by keyboard brings the data back.
  await page.keyboard.press("ArrowLeft");
  const retry = signIns.getByRole("button", { name: "Try again", exact: true });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(states.getByRole("radio", { name: "data", exact: true })).toBeChecked();
  await expect(rows).toHaveCount(5);
  await expectNoHorizontalScroll(page);
});

test("setup checklist: progress as text, one open group, tasks done by keyboard, the completion message", async ({ page }) => {
  await openBody(page, "/ds/feedback");
  const list = page.locator('[data-slot="setup-checklist"]').filter({ has: page.getByRole("heading", { level: 2, name: "Finish setting up", exact: true }) });
  const bar = list.getByRole("progressbar", { name: "Finish setting up", exact: true });
  const group = (label: string) => list.locator("details").filter({ has: page.locator("summary", { hasText: label }) });
  await list.scrollIntoViewIfNeeded();
  await expect(list.getByText("1 of 5 done", { exact: true })).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuetext", "1 of 5 done");
  // Only the first group with a task left is open.
  await expect(group("Secure your account")).toHaveAttribute("open", "");
  await expect(list.locator("details[open]")).toHaveCount(1);
  await expect(list.locator('[data-slot="setup-task"][data-done]')).toContainText(["Change the first password"]);
  await expect(list.locator('[data-slot="setup-task"][data-done]')).toContainText(["Done"]);

  // Its last task done (Enter on the action): the group closes, the next one opens and its summary takes the focus
  // the unmounted action had.
  await list.getByRole("button", { name: "Turn on 2FA", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(list.getByText("2 of 5 done", { exact: true })).toBeVisible();
  await expect(group("Secure your account")).not.toHaveAttribute("open", "");
  await expect(group("Add your team")).toHaveAttribute("open", "");
  await expect(group("Add your team").locator("summary")).toBeFocused();

  // From here by Tab and Enter alone, never focused by hand: focus stays in the checklist after every task.
  await page.keyboard.press("Tab");
  await expect(list.getByRole("button", { name: "Invite user", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("button", { name: "Create role", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(group("Review activity")).toHaveAttribute("open", "");
  await expect(group("Review activity").locator("summary")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(list.getByRole("button", { name: "Open activity log", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  // Every task done: the message replaces the groups inside the status region, which takes the focus; the next Tab
  // reaches the button inside it.
  await expect(list.getByRole("status")).toContainText("Setup is complete. Every task is done.");
  await expect(list.getByRole("status")).toBeFocused();
  await expect(list.locator("details")).toHaveCount(0);
  await expect(bar).toHaveAttribute("aria-valuetext", "5 of 5 done");
  await page.keyboard.press("Tab");
  await expect(list.getByRole("button", { name: "Reset tasks", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(list.getByText("0 of 5 done", { exact: true })).toBeVisible();
  await expect(group("Secure your account").locator("summary")).toBeFocused();
  // A closed group opens from its summary by keyboard.
  await group("Review activity").locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("button", { name: "Open activity log", exact: true })).toBeVisible();

  // Link actions, the caller's progress text; a list that is done from the first paint; one without an action.
  const access = page.locator('[data-slot="setup-checklist"]').filter({ has: page.getByRole("heading", { level: 3, name: "Access setup", exact: true }) });
  await expect(access.getByText("1 of 3 tasks done", { exact: true })).toBeVisible();
  await expect(access.getByRole("link", { name: "Create role", exact: true })).toHaveAttribute("href", "/ds/data");
  const finished = page.locator('[data-slot="setup-checklist"]').filter({ has: page.getByRole("heading", { level: 3, name: "Setup", exact: true }) });
  await expect(finished.getByRole("status")).toContainText("Setup is complete. You can change any of this in your profile.");
  const single = page.locator('[data-slot="setup-checklist"]').filter({ has: page.getByRole("heading", { level: 3, name: "One step left", exact: true }) });
  await expect(single.getByRole("button")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
