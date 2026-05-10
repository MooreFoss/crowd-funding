import { defineConfig } from "@playwright/test";

const playwrightDatabaseSchema =
  process.env.PLAYWRIGHT_DATABASE_SCHEMA ?? "cf_playwright_e2e";

process.env.PLAYWRIGHT_DATABASE_SCHEMA = playwrightDatabaseSchema;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/playwright-server.mjs",
    env: {
      ...process.env,
      PLAYWRIGHT_DATABASE_SCHEMA: playwrightDatabaseSchema,
    },
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
