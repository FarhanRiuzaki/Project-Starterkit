import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

/** Browser artifacts and the signed-in state live under .superpowers/scratch/ (gitignored). */
export const SCRATCH = path.resolve(import.meta.dirname, "../../../../.superpowers/scratch/t12c");
export const AUTH_STATE = path.join(SCRATCH, "auth-state.json");

/** Signs in once per run (the sign-in rate limit allows 5 per minute per username) and saves the cookie. */
export default async function globalSetup(config: FullConfig) {
  mkdirSync(SCRATCH, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: config.projects[0]!.use.baseURL });
  await page.goto("/login");
  await page.locator("#login").fill("superadmin");
  await page.locator("#password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.context().storageState({ path: AUTH_STATE });
  await browser.close();
}
