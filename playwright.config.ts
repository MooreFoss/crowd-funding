import { defineConfig } from "@playwright/test";

const playwrightDatabaseSchema =
  process.env.PLAYWRIGHT_DATABASE_SCHEMA ?? "cf_playwright_e2e";
const playwrightZpayCreateEndpoint =
  process.env.ZPAY_CREATE_ENDPOINT ?? "http://127.0.0.1:3100/mapi.php";
const playwrightZpayOrderQueryEndpoint =
  process.env.ZPAY_ORDER_QUERY_ENDPOINT ?? "http://127.0.0.1:3100/api.php";
const playwrightZpayNotifyUrl =
  process.env.ZPAY_NOTIFY_URL ?? "http://127.0.0.1:3000/api/payments/notify";
const playwrightZpayReturnUrl =
  process.env.ZPAY_RETURN_URL ?? "http://127.0.0.1:3000/payment/return";
const playwrightZpayMerchantId =
  process.env.ZPAY_MCH_ID ?? "test-zpay-merchant";
const playwrightZpayKey = process.env.ZPAY_KEY ?? "test-zpay-key";

process.env.PLAYWRIGHT_DATABASE_SCHEMA = playwrightDatabaseSchema;
process.env.ZPAY_CREATE_ENDPOINT = playwrightZpayCreateEndpoint;
process.env.ZPAY_ORDER_QUERY_ENDPOINT = playwrightZpayOrderQueryEndpoint;
process.env.ZPAY_NOTIFY_URL = playwrightZpayNotifyUrl;
process.env.ZPAY_RETURN_URL = playwrightZpayReturnUrl;
process.env.ZPAY_MCH_ID = playwrightZpayMerchantId;
process.env.ZPAY_KEY = playwrightZpayKey;

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
      ZPAY_CREATE_ENDPOINT: playwrightZpayCreateEndpoint,
      ZPAY_ORDER_QUERY_ENDPOINT: playwrightZpayOrderQueryEndpoint,
      ZPAY_NOTIFY_URL: playwrightZpayNotifyUrl,
      ZPAY_RETURN_URL: playwrightZpayReturnUrl,
      ZPAY_MCH_ID: playwrightZpayMerchantId,
      ZPAY_KEY: playwrightZpayKey,
    },
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
