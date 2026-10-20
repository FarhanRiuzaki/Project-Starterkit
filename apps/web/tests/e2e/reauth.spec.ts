import { expect, test } from "@playwright/test";
import { ageReauth, SEED, signIn } from "./helpers";

/**
 * Connecting Google adds a way to sign in, so a session that hasn't proved the user within 10 minutes asks for the
 * password first, in a dialog (a bottom sheet on the phone). Runs on the desktop and mobile projects; each run connects
 * and then disconnects, so the seed stays as it was.
 */
test("connect Google from an older session asks for the password, then goes through the provider", async ({ page }, info) => {
  await signIn(page, "viewer@example.com");
  await expect(page).toHaveURL("/");
  ageReauth("viewer@example.com");
  await page.goto("/me/security");
  const google = page.getByRole("listitem").filter({ hasText: /^Google/ }); // not the toast ("Connected Google.")
  await expect(google).toContainText("Not connected");
  await google.getByRole("button", { name: "Connect Google" }).click();

  const dialog = page.getByRole("dialog", { name: "Connect Google" });
  await expect(dialog).toBeVisible();
  if (info.project.name === "mobile") {
    // Below 768 px the dialog is a bottom sheet: full width, flush with the bottom edge.
    const box = (await dialog.boundingBox())!;
    const view = page.viewportSize()!;
    expect(Math.round(box.width)).toBe(view.width);
    expect(Math.round(box.y + box.height)).toBe(view.height);
  }
  const password = dialog.getByLabel("Password");
  await password.fill("Wrong-password-1");
  await dialog.getByRole("button", { name: "Connect Google" }).click();
  await expect(dialog.getByRole("alert")).toContainText("The current password is wrong.");
  await expect(password).toBeFocused();
  await password.fill(SEED.password);
  await dialog.getByRole("button", { name: "Connect Google" }).click(); // reauth, then the mock provider's round trip

  await expect(page.getByText("Connected Google.")).toBeVisible();
  await expect(page).toHaveURL("/me/security");
  await google.getByRole("button", { name: "Disconnect Google" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disconnect Google" }).click();
  await expect(google).toContainText("Not connected");
});
