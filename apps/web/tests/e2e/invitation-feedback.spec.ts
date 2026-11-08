import { expect, test } from "@playwright/test";
import path from "node:path";
import { AUTH_STATE, SCRATCH } from "./global-setup";
import { csrfOf, expectNoHorizontalScroll } from "./helpers";

test.use({ storageState: AUTH_STATE });
for (const method of ["invite", "password", "directory"] as const) test(`${method}: create feedback states only the confirmed response`, async ({ page }) => {
  test.setTimeout(45_000);
  if (method === "invite") await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/users/new");
  const csrf = await csrfOf(page);
  const suffix = `${Date.now()}${method}`;
  const name = `Batch A ${method} ${suffix}`;
  const username = `ba-${suffix}`;
  let createdId: string | undefined;
  let attempts = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  // Only the error/pending state is a controlled fixture; final creation below reaches the real BFF/API/database.
  await page.route("**/api/users", async route => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    if (method === "invite" && attempts === 1) {
      await gate;
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "duplicate", message: "A user with this username already exists." } }) });
    }
    return route.continue();
  });
  try {
    const invite = page.getByRole("radio", { name: "Invite by email", exact: true });
    await page.getByRole("checkbox", { name: "Active", exact: true }).uncheck();
    await expect(invite).toBeDisabled();
    await expect(page.getByText("Activate this user to use an invitation.", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "Active", exact: true }).check();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await page.getByRole("textbox", { name: "Username", exact: true }).fill(username);
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(`${username}@example.test`);
    await page.getByRole("radio", { name: method === "invite" ? "Invite by email" : method === "password" ? "Set a password now" : "Directory user", exact: true }).check();
    if (method === "password") await page.getByRole("textbox", { name: "Password", exact: true }).fill("Password123!batchA");
    const save = page.getByRole("button", { name: "Create user", exact: true });
    if (method === "invite") {
      await expect(page.getByText("The user chooses a password using a link valid for 72 hours. Email delivery isn't confirmed here.", { exact: true })).toBeVisible();
      await page.getByText("The user chooses a password using a link valid for 72 hours. Email delivery isn't confirmed here.", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SCRATCH, "batch-a-invite-phone.png"), animations: "disabled", scale: "css" });
      await save.click();
      await expect(save).toBeDisabled();
      await expect(save).toHaveAttribute("aria-busy", "true");
      await expect(page.getByText(`Created ${name}.`, { exact: true })).toHaveCount(0);
      expect(attempts).toBe(1);
      release();
      await expect(page.getByRole("alert").filter({ hasText: "A user with this username already exists." })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(name);
      await expect(invite).toBeChecked();
      await expect(save).toBeEnabled();
      await page.waitForTimeout(250);
      expect(attempts).toBe(1); // no automatic mutation retry
      await expect(page.getByText(`Created ${name}.`, { exact: true })).toHaveCount(0);
    }
    const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/users") && response.request().method() === "POST" && response.status() === 201);
    await save.click();
    const response = await responsePromise;
    const created = await response.json();
    createdId = created.id;
    expect(created.name).toBe(name);
    expect(created).not.toHaveProperty("delivery");
    await expect(page).toHaveURL(new RegExp(`/users/${createdId}$`));
    const toast = page.getByRole("listitem").filter({ hasText: `Created ${name}.` });
    await expect(toast).toBeVisible();
    if (method === "invite") await expect(toast).toContainText("Email delivery isn't confirmed here.");
    else await expect(toast).not.toContainText("Email delivery isn't confirmed here.");
    await expect(toast).not.toContainText(/sent|delivered|queued|token|https?:/i);
    expect(attempts).toBe(method === "invite" ? 2 : 1);
    const stored = await page.request.get(`/api/users/${createdId}`);
    expect(stored.ok()).toBe(true);
    expect((await stored.json()).name).toBe(name);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: path.join(SCRATCH, `batch-a-${method}-success.png`), animations: "disabled" });
  } finally {
    release();
    if (createdId) expect((await page.request.delete(`/api/users/${createdId}`, { headers: { "x-csrf-token": csrf } })).ok()).toBe(true);
  }
});
