import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./global-setup";
import { axeSerious, expectNoHorizontalScroll, settleAnimations } from "./helpers";

test.use({ storageState: AUTH_STATE, reducedMotion: "reduce" });

test("upload supports native keyboard browse, nested drag, validation and individual removal", async ({ page }, info) => {
  await page.goto("/ds");
  const group = page.getByRole("group", { name: "Import users", exact: true });
  const browse = group.getByRole("button", { name: "Choose files for Import users", exact: true });
  const dropzone = group.locator('[data-slot="file-dropzone"]');
  await browse.scrollIntoViewIfNeeded();
  await dropzone.dispatchEvent("dragenter");
  await expect(dropzone).toHaveAttribute("data-dragging", "true");
  await expect(group.getByText("Drop to upload", { exact: true })).toBeVisible();
  await dropzone.screenshot({ path: info.outputPath("upload-dragging.png"), animations: "disabled" });
  await dropzone.locator('[data-slot="upload-icon"]').dispatchEvent("dragenter");
  await dropzone.dispatchEvent("dragleave");
  await expect(dropzone).toHaveAttribute("data-dragging", "true");
  await dropzone.locator('[data-slot="upload-icon"]').dispatchEvent("dragleave");
  await expect(dropzone).not.toHaveAttribute("data-dragging", "true");

  await browse.focus();
  const picker = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await picker).setFiles([
    { name: "first.csv", mimeType: "text/csv", buffer: Buffer.from("name,email\nAlex,alex@example.com") },
    { name: "second.csv", mimeType: "text/csv", buffer: Buffer.from("name,email\nNoor,noor@example.com") },
  ]);
  await expect(group.locator('[data-slot="file-item"]')).toHaveCount(2);
  await group.getByRole("button", { name: "Remove first.csv", exact: true }).click();
  await expect(group.locator('[data-slot="file-item"]')).toHaveCount(1);
  await expect(browse).toBeFocused();
  await group.locator('input[type="file"]').setInputFiles({ name: "script.js", mimeType: "text/javascript", buffer: Buffer.from("bad") });
  await expect(group.getByRole("alert")).toHaveText("Choose a supported file type.");
  await expect(group.getByText("second.csv", { exact: true })).toBeVisible();

  const data = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(["name,email"], "dropped.csv", { type: "text/csv" })); return data; });
  await dropzone.dispatchEvent("drop", { dataTransfer: data });
  await expect(group.getByRole("alert")).toHaveCount(0);
  await expect(group.getByText("dropped.csv", { exact: true })).toBeVisible();
  const disabled = page.getByRole("group", { name: "Unavailable upload", exact: true });
  await expect(disabled.getByRole("button")).toBeDisabled();
  await disabled.locator('[data-slot="file-dropzone"]').dispatchEvent("dragenter");
  await expect(disabled.locator('[data-slot="file-dropzone"]')).not.toHaveAttribute("data-dragging", "true");

  const examples = page.locator('[data-slot="file-item-examples"]');
  await expect(examples.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "64");
  await expect(examples.getByRole("status", { name: "" }).filter({ hasText: "Upload complete" })).toHaveCount(1);
  await expect(examples.getByRole("alert")).toHaveText("Row 17: email is missing");
  await examples.getByRole("button", { name: "Cancel upload of users-finance-nov.csv", exact: true }).click();
  await expect(examples.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset file examples", exact: true }).click();
  await expect(examples.getByRole("progressbar")).toHaveCount(1);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`upload layout fits desktop and phone in ${colorScheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/ds");
    const panel = page.getByRole("heading", { name: "File upload", exact: true }).locator("../..").filter({ has: page.getByRole("group", { name: "Import users", exact: true }) });
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await panel.scrollIntoViewIfNeeded();
      await settleAnimations(page);
      await expectNoHorizontalScroll(page);
      await panel.screenshot({ path: info.outputPath(`upload-${colorScheme}-${width}.png`), animations: "disabled" });
    }
    expect(await axeSerious(page)).toEqual([]);
  });
}
