import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import { Pool } from "pg";

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((environment, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return environment;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        return environment;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

      environment[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return environment;
    }, {});
}

function readDatabaseUrl() {
  const env = {
    ...parseEnvFile(join(process.cwd(), ".env")),
    ...parseEnvFile(join(process.cwd(), ".env.local")),
    ...process.env,
  };
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Playwright sponsor tests.");
  }

  return databaseUrl;
}

function readDatabaseSchema() {
  const schema = process.env.PLAYWRIGHT_DATABASE_SCHEMA ?? "cf_playwright_e2e";

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(
      `PLAYWRIGHT_DATABASE_SCHEMA must be a valid PostgreSQL identifier. Received: ${schema}`,
    );
  }

  return schema;
}

function withSchemaSearchPath(databaseUrl: string, schema: string) {
  const connection = new URL(databaseUrl);
  connection.searchParams.set("options", `-c search_path=${schema},public`);
  return connection.toString();
}

test.describe("wechatpay sponsor entry", () => {
  const pool = new Pool({
    connectionString: withSchemaSearchPath(
      readDatabaseUrl(),
      readDatabaseSchema(),
    ),
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test.beforeEach(async () => {
    const termsId = `PW-TERMS-${randomUUID().slice(0, 8)}`;
    const publishedAt = new Date("2026-05-10T12:00:00.000Z");

    await pool.query(`DELETE FROM terms_versions WHERE status = 'ACTIVE'`);
    await pool.query(
      `INSERT INTO terms_versions (
        id, version, title, body, status, published_at, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, 'Playwright Terms', 'Sponsor flow terms body', 'ACTIVE', $3, 'playwright', $3, $3
      )`,
      [termsId, `v-${termsId}`, publishedAt],
    );
  });

  test("desktop sponsor flow creates a Native order and shows a QR payment panel", async ({
    page,
  }) => {
    const prefix = `PW-${randomUUID().slice(0, 8)}`;

    await page.goto("/sponsor");
    await page.getByLabel("赞助金额 (¥)").fill("12.34");
    await page.getByLabel("展示昵称").fill(prefix);
    await page.getByLabel("留言 (可选)").fill("Playwright native flow");
    await page.getByLabel(/我已阅读并同意/).check();
    await page.getByRole("button", { name: "确认并去支付" }).click();

    await expect(
      page.getByText("微信支付 Native 二维码"),
    ).toBeVisible();
    await expect(page.locator("svg").filter({ hasText: "微信支付二维码" })).toBeVisible();
    await expect(page.getByText("支付成功")).toBeVisible();
    await expect(page).not.toHaveURL(/mini-program-jump/);
  });

  test("mobile sponsor flow opens the mini program jump page without creating Native orders", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        configurable: true,
      });
    });
    let nativeOrderCalled = false;

    await page.route("**/api/sponsorship/native-orders", (route) => {
      nativeOrderCalled = true;
      void route.abort();
    });

    await page.goto("/sponsor");
    await page.getByLabel("赞助金额 (¥)").fill("6.66");
    await page.getByLabel(/我已阅读并同意/).check();
    await page.getByRole("button", { name: "确认并去支付" }).click();

    await expect(page).toHaveURL(/\/sponsor\/mini-program-jump/);
    await expect(page.getByRole("heading", { name: "打开小程序继续支付" })).toBeVisible();
    await expect(page.getByRole("link", { name: "打开小程序" })).toBeVisible();
    expect(nativeOrderCalled).toBe(false);
  });
});
