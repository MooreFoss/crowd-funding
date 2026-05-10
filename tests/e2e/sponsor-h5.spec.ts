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

test.describe("sponsor h5 flow", () => {
  const pool = new Pool({
    connectionString: withSchemaSearchPath(
      readDatabaseUrl(),
      readDatabaseSchema(),
    ),
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test("submits the sponsor form, returns from the H5 cashier, and shows the paid record", async ({
    page,
  }) => {
    const prefix = `PW-${randomUUID().slice(0, 8)}`;
    const termsId = `${prefix}-terms`;
    const publishedAt = new Date("2026-05-10T12:00:00.000Z");

    await pool.query(
      `INSERT INTO terms_versions (
        id, version, title, body, status, published_at, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'Sponsor flow terms body', 'ACTIVE', $4, 'playwright', $4, $4
      )`,
      [termsId, `${prefix}-v1`, `${prefix} Terms`, publishedAt],
    );

    try {
      await page.goto("/sponsor");
      await expect(
        page.getByRole("heading", { name: "发起赞助" }),
      ).toBeVisible();
      await expect(page.getByText(`${prefix}-v1`)).toBeVisible();

      await page.getByLabel("赞助金额 (¥)").fill("12.34");
      await page.getByLabel("展示昵称").fill(prefix);
      await page.getByLabel("留言 (可选)").fill("Playwright sponsor flow");
      await page.getByLabel(/我已阅读并同意/).check();
      await page.getByRole("button", { name: "确认并去支付" }).click();

      await page.waitForURL("**/payment/return");
      await expect(page.getByRole("heading", { name: "处理中" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "支付成功" }),
      ).toBeVisible();

      await page.goto("/pledges");
      await expect(page.getByText(prefix)).toBeVisible();
      await expect(page.getByText("¥ 12.34")).toBeVisible();
    } finally {
      await pool.query(`DELETE FROM pledges WHERE public_name = $1`, [prefix]);
      await pool.query(`DELETE FROM terms_versions WHERE id = $1`, [termsId]);
    }
  });
});
