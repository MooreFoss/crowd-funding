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
const playwrightAdminUsername = process.env.ADMIN_USERNAME ?? "test-admin";
const playwrightAdminPasswordHash =
  process.env.ADMIN_PASSWORD_HASH ?? "test-password";
const playwrightSessionSecret =
  process.env.SESSION_SECRET ?? "test-session-secret";
const playwrightTencentSecretId =
  process.env.TENCENT_SECRET_ID ?? "test-tencent-secret-id";
const playwrightTencentSecretKey =
  process.env.TENCENT_SECRET_KEY ?? "test-tencent-secret-key";
const playwrightTencentTmsRegion =
  process.env.TENCENT_TMS_REGION ?? "ap-beijing";
const playwrightTencentTmsEndpoint =
  process.env.TENCENT_TMS_ENDPOINT ?? "http://127.0.0.1:3200";

process.env.PLAYWRIGHT_DATABASE_SCHEMA = playwrightDatabaseSchema;
process.env.ZPAY_CREATE_ENDPOINT = playwrightZpayCreateEndpoint;
process.env.ZPAY_ORDER_QUERY_ENDPOINT = playwrightZpayOrderQueryEndpoint;
process.env.ZPAY_NOTIFY_URL = playwrightZpayNotifyUrl;
process.env.ZPAY_RETURN_URL = playwrightZpayReturnUrl;
process.env.ZPAY_MCH_ID = playwrightZpayMerchantId;
process.env.ZPAY_KEY = playwrightZpayKey;
process.env.ADMIN_USERNAME = playwrightAdminUsername;
process.env.ADMIN_PASSWORD_HASH = playwrightAdminPasswordHash;
process.env.SESSION_SECRET = playwrightSessionSecret;
process.env.TENCENT_SECRET_ID = playwrightTencentSecretId;
process.env.TENCENT_SECRET_KEY = playwrightTencentSecretKey;
process.env.TENCENT_TMS_REGION = playwrightTencentTmsRegion;
process.env.TENCENT_TMS_ENDPOINT = playwrightTencentTmsEndpoint;

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
      ADMIN_USERNAME: playwrightAdminUsername,
      ADMIN_PASSWORD_HASH: playwrightAdminPasswordHash,
      SESSION_SECRET: playwrightSessionSecret,
      TENCENT_SECRET_ID: playwrightTencentSecretId,
      TENCENT_SECRET_KEY: playwrightTencentSecretKey,
      TENCENT_TMS_REGION: playwrightTencentTmsRegion,
      TENCENT_TMS_ENDPOINT: playwrightTencentTmsEndpoint,
    },
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
