import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

/**
 * Minimal Playwright setup (Task 12c; Task 13 extends it): a production build on its own port (never the dev
 * server on :3000), desktop viewport, artifacts under .superpowers/scratch/ (gitignored).
 * E2E_REUSE=1 reuses a server already running on E2E_PORT.
 */
const PORT = Number(process.env.E2E_PORT ?? 3123);

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "../../.superpowers/scratch/t12c/test-results",
  reporter: [["list"]],
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: {
    command: `bun run build && bun run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: process.env.E2E_REUSE === "1",
    timeout: 300_000,
    env: { SESSION_SECRET: randomBytes(32).toString("base64url") },
  },
});
