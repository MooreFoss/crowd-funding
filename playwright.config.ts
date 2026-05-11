import { defineConfig } from "@playwright/test";

const playwrightDatabaseSchema =
  process.env.PLAYWRIGHT_DATABASE_SCHEMA ?? "cf_playwright_e2e";
const playwrightNextPort = process.env.PLAYWRIGHT_NEXT_PORT ?? "3000";
const playwrightBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightNextPort}`;
const playwrightWechatPayEndpoint =
  process.env.WECHAT_PAY_API_ENDPOINT ?? "http://127.0.0.1:3100";
const playwrightAdminUsername = process.env.ADMIN_USERNAME ?? "test-admin";
const playwrightAdminPassword =
  process.env.ADMIN_PASSWORD ?? "test-password";
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
process.env.WECHAT_PAY_API_ENDPOINT = playwrightWechatPayEndpoint;
process.env.WECHAT_PAY_APP_ID = process.env.WECHAT_PAY_APP_ID ?? "wx-playwright-app";
process.env.WECHAT_PAY_MCH_ID = process.env.WECHAT_PAY_MCH_ID ?? "playwright-mch";
process.env.WECHAT_PAY_API_V3_KEY =
  process.env.WECHAT_PAY_API_V3_KEY ?? "12345678901234567890123456789012";
process.env.WECHAT_PAY_MERCHANT_SERIAL_NO =
  process.env.WECHAT_PAY_MERCHANT_SERIAL_NO ?? "playwright-merchant-serial";
process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH =
  process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH ?? ".tmp/playwright-secrets/apiclient_key.pem";
process.env.WECHAT_PAY_PUBLIC_KEY_ID =
  process.env.WECHAT_PAY_PUBLIC_KEY_ID ?? "playwright-wechatpay-serial";
process.env.WECHAT_PAY_PUBLIC_KEY_PATH =
  process.env.WECHAT_PAY_PUBLIC_KEY_PATH ?? ".tmp/playwright-secrets/wechatpay_public.pem";
process.env.WECHAT_PAY_NOTIFY_URL =
  process.env.WECHAT_PAY_NOTIFY_URL ?? `${playwrightBaseUrl}/api/payments/notify`;
process.env.WECHAT_PAY_REFUND_NOTIFY_URL =
  process.env.WECHAT_PAY_REFUND_NOTIFY_URL ?? `${playwrightBaseUrl}/api/refunds/notify`;
process.env.WECHAT_MINI_PROGRAM_APP_SECRET =
  process.env.WECHAT_MINI_PROGRAM_APP_SECRET ?? "playwright-mini-secret";
process.env.WECHAT_MINI_PROGRAM_URL_LINK =
  process.env.WECHAT_MINI_PROGRAM_URL_LINK ?? "https://wxaurl.cn/playwright";
process.env.WECHAT_MINI_PROGRAM_URL_SCHEME =
  process.env.WECHAT_MINI_PROGRAM_URL_SCHEME ?? "weixin://dl/business/?t=playwright";
process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_APP_ID =
  process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_APP_ID ?? "wx-playwright-app";
process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_PATH =
  process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_PATH ?? "pages/crowdfunding/sponsor";
process.env.ADMIN_USERNAME = playwrightAdminUsername;
process.env.ADMIN_PASSWORD = playwrightAdminPassword;
process.env.SESSION_SECRET = playwrightSessionSecret;
process.env.TENCENT_SECRET_ID = playwrightTencentSecretId;
process.env.TENCENT_SECRET_KEY = playwrightTencentSecretKey;
process.env.TENCENT_TMS_REGION = playwrightTencentTmsRegion;
process.env.TENCENT_TMS_ENDPOINT = playwrightTencentTmsEndpoint;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/playwright-server.mjs",
    env: {
      ...process.env,
      PLAYWRIGHT_DATABASE_SCHEMA: playwrightDatabaseSchema,
      WECHAT_PAY_API_ENDPOINT: playwrightWechatPayEndpoint,
      WECHAT_PAY_APP_ID: process.env.WECHAT_PAY_APP_ID,
      WECHAT_PAY_MCH_ID: process.env.WECHAT_PAY_MCH_ID,
      WECHAT_PAY_API_V3_KEY: process.env.WECHAT_PAY_API_V3_KEY,
      WECHAT_PAY_MERCHANT_SERIAL_NO:
        process.env.WECHAT_PAY_MERCHANT_SERIAL_NO,
      WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH:
        process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH,
      WECHAT_PAY_PUBLIC_KEY_ID: process.env.WECHAT_PAY_PUBLIC_KEY_ID,
      WECHAT_PAY_PUBLIC_KEY_PATH: process.env.WECHAT_PAY_PUBLIC_KEY_PATH,
      WECHAT_PAY_NOTIFY_URL: process.env.WECHAT_PAY_NOTIFY_URL,
      WECHAT_PAY_REFUND_NOTIFY_URL: process.env.WECHAT_PAY_REFUND_NOTIFY_URL,
      WECHAT_MINI_PROGRAM_APP_SECRET:
        process.env.WECHAT_MINI_PROGRAM_APP_SECRET,
      WECHAT_MINI_PROGRAM_URL_LINK:
        process.env.WECHAT_MINI_PROGRAM_URL_LINK,
      WECHAT_MINI_PROGRAM_URL_SCHEME:
        process.env.WECHAT_MINI_PROGRAM_URL_SCHEME,
      NEXT_PUBLIC_WECHAT_MINI_PROGRAM_APP_ID:
        process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_APP_ID,
      NEXT_PUBLIC_WECHAT_MINI_PROGRAM_PATH:
        process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_PATH,
      PLAYWRIGHT_NEXT_PORT: playwrightNextPort,
      ADMIN_USERNAME: playwrightAdminUsername,
      ADMIN_PASSWORD: playwrightAdminPassword,
      SESSION_SECRET: playwrightSessionSecret,
      TENCENT_SECRET_ID: playwrightTencentSecretId,
      TENCENT_SECRET_KEY: playwrightTencentSecretKey,
      TENCENT_TMS_REGION: playwrightTencentTmsRegion,
      TENCENT_TMS_ENDPOINT: playwrightTencentTmsEndpoint,
    },
    url: playwrightBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
