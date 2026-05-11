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
    throw new Error("DATABASE_URL is required for Playwright admin tests.");
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

test.describe("admin smoke", () => {
  const pool = new Pool({
    connectionString: withSchemaSearchPath(
      readDatabaseUrl(),
      readDatabaseSchema(),
    ),
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test("shows live dashboard metrics and audit logs", async ({ page }) => {
    const response = await page.request.post("/api/admin/session", {
      data: {
        username: "test-admin",
        password: "test-password",
      },
    });

    expect(response.status()).toBe(200);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "管理控制台概览" })).toBeVisible();
    await expect(page.getByText("资金池余额")).toBeVisible();
    await expect(page.getByText("待处理退款")).toBeVisible();
    await expect(page.getByText("审核异常")).toBeVisible();

    await page.goto("/admin/audit-logs");
    await expect(page.getByRole("heading", { name: "审计日志" })).toBeVisible();
    await expect(page.getByText("ADMIN_LOGIN").first()).toBeVisible();

    await pool.query(
      `DELETE FROM audit_logs WHERE action = 'ADMIN_LOGIN' AND actor_id = 'test-admin'`,
    );
  });

  test("does not expose TMS configuration in admin settings", async ({ page }) => {
    const response = await page.request.post("/api/admin/session", {
      data: {
        username: "test-admin",
        password: "test-password",
      },
    });

    expect(response.status()).toBe(200);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "系统全局配置" })).toBeVisible();
    await expect(page.getByText("内容安全与审核 (TMS)")).not.toBeVisible();
    await expect(page.getByLabel("TMS 服务端点 (API Endpoint)")).not.toBeVisible();
    await expect(page.getByLabel("TMS API 密钥")).not.toBeVisible();

    await pool.query(
      `DELETE FROM audit_logs WHERE action = 'ADMIN_LOGIN' AND actor_id = 'test-admin'`,
    );
  });
});
