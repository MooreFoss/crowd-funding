import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const ADMIN_SESSION_COOKIE_NAME = "cf_admin_session";

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
    throw new Error("DATABASE_URL is required for Playwright closeout tests.");
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

async function login(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/admin/session", {
    data: {
      username: "test-admin",
      password: "test-password",
    },
  });

  expect(response.status()).toBe(200);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理控制台概览" })).toBeVisible();

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === ADMIN_SESSION_COOKIE_NAME,
  );

  if (!sessionCookie) {
    throw new Error("Admin session cookie was not set.");
  }

  return `${sessionCookie.name}=${sessionCookie.value}`;
}

test.describe("campaign closeout refunds", () => {
  const pool = new Pool({
    connectionString: withSchemaSearchPath(
      readDatabaseUrl(),
      readDatabaseSchema(),
    ),
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test("closes the campaign, locks sponsor flow, and creates batch refund progress", async ({
    page,
  }) => {
    const prefix = `PW-CLOSE-${randomUUID().slice(0, 8)}`;
    const firstPledgeId = `${prefix}-pledge-1`;
    const secondPledgeId = `${prefix}-pledge-2`;
    const expenseId = `${prefix}-expense`;
    const now = new Date("2026-05-10T12:00:00.000Z");

    await pool.query(
      `INSERT INTO pledges (
        id, merchant_order_no, payment_channel, provider_order_no, user_key, submitted_name, public_name,
        submitted_message, public_message, amount_fen, refunded_fen, net_amount_fen, status,
        payment_redirect_url, terms_version_id, terms_accepted_at, paid_at, cancelled_at, failed_at, created_at, updated_at
      ) VALUES
        ($1, $2, 'ZPAY_WECHAT_H5', $3, 'close-user-1', 'Close User 1', 'Close User 1', NULL, NULL, 8000, 0, 8000, 'PAID', NULL, NULL, NULL, $7, NULL, NULL, $7, $7),
        ($4, $5, 'ZPAY_WECHAT_H5', $6, 'close-user-2', 'Close User 2', 'Close User 2', NULL, NULL, 4000, 0, 4000, 'PAID', NULL, NULL, NULL, $7, NULL, NULL, $7, $7)`,
      [
        firstPledgeId,
        `${prefix}-ORDER-1`,
        `${prefix}-ZPAY-1`,
        secondPledgeId,
        `${prefix}-ORDER-2`,
        `${prefix}-ZPAY-2`,
        now,
      ],
    );
    await pool.query(
      `INSERT INTO expenses (
        id, title, amount_fen, description, detail_visibility, created_by, created_at, updated_at
      ) VALUES ($1, $2, 2000, 'Closeout expense', 'PUBLIC', 'playwright', $3, $3)`,
      [expenseId, `${prefix} Expense`, now],
    );

    try {
      const adminCookie = await login(page);
      await page.goto("/admin/refunds");
      await expect(page.getByText("进行中")).toBeVisible();

      const closeResponse = await page.request.post("/api/admin/funding/close", {
        headers: {
          cookie: adminCookie,
        },
        data: {
          closeReason: `${prefix} close reason`,
        },
      });

      expect(closeResponse.status()).toBe(200);
      await page.goto("/admin/refunds");
      await expect(page.getByText("关闭中")).toBeVisible();
      await expect(page.getByText("¥ 100.00")).toBeVisible();

      const batchResponse = await page.request.post("/api/admin/funding/batch-refunds", {
        headers: {
          cookie: adminCookie,
        },
        data: {},
      });

      expect(batchResponse.status()).toBe(201);
      await page.goto("/admin/refunds");
      await expect(page.getByText("退款处理中")).toBeVisible();
      await expect(page.getByText(/BATCH-/).first()).toBeVisible();

      await page.goto("/sponsor");
      await expect(page.getByText("众筹已结束，当前不能创建新的赞助订单。")).toBeVisible();
      await expect(page.getByRole("button", { name: "众筹已结束" })).toBeDisabled();
    } finally {
      await pool.query(`DELETE FROM refunds WHERE pledge_id = ANY($1::text[])`, [
        [firstPledgeId, secondPledgeId],
      ]);
      await pool.query(`DELETE FROM campaign_state WHERE id = 'default'`);
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
      await pool.query(`DELETE FROM pledges WHERE id = ANY($1::text[])`, [
        [firstPledgeId, secondPledgeId],
      ]);
    }
  });
});
