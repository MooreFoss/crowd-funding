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
    throw new Error("DATABASE_URL is required for Playwright public browse tests.");
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

test.describe("public browse", () => {
  const pool = new Pool({
    connectionString: withSchemaSearchPath(
      readDatabaseUrl(),
      readDatabaseSchema(),
    ),
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test("renders real summary, pledge list, expense list, and expense detail pages", async ({
    page,
  }) => {
    const prefix = `PW-${randomUUID().slice(0, 8)}`;
    const campaignId = `${prefix}-campaign`;
    const bobPledgeId = `${prefix}-pledge-bob`;
    const alicePledgeId = `${prefix}-pledge-alice`;
    const charliePledgeId = `${prefix}-pledge-charlie`;
    const publicExpenseId = `${prefix}-expense-public`;
    const auditExpenseId = `${prefix}-expense-audit`;
    const publicEvidenceId = `${prefix}-evidence-public`;
    const auditEvidenceId = `${prefix}-evidence-audit`;
    const paidAt = new Date("2026-05-10T08:00:00.000Z");
    const now = new Date("2026-05-10T08:10:00.000Z");
    await pool.query(
      `INSERT INTO campaign_state (
        id, status, close_reason, close_snapshot, close_snapshot_at, closed_at, closed_by, refund_batch_no, refund_progress, settled_at, created_at, updated_at
      ) VALUES (
        $1, 'CLOSING', 'Playwright closeout', NULL, NULL, $2, 'playwright', NULL, NULL, NULL, $2, $2
      )`,
      [campaignId, now],
    );
    await pool.query(
      `INSERT INTO pledges (
        id, merchant_order_no, payment_channel, provider_order_no, user_key, submitted_name, public_name, submitted_message, public_message,
        amount_fen, refunded_fen, net_amount_fen, status, payment_redirect_url, terms_version_id, terms_accepted_at,
        paid_at, cancelled_at, failed_at, created_at, updated_at
      ) VALUES
        ($1, $2, 'ZPAY_WECHAT_H5', 'ZPAY-PW-1', 'user-bob', $3, $3, 'Bob message', 'Bob message', 2000, 0, 2000, 'PAID', NULL, NULL, NULL, $10, NULL, NULL, $10, $10),
        ($4, $5, 'ZPAY_WECHAT_H5', 'ZPAY-PW-2', 'user-alice', $6, $6, 'Alice message', 'Alice message', 1000, 200, 800, 'PARTIAL_REFUNDED', NULL, NULL, NULL, $10, NULL, NULL, $10, $10),
        ($7, $8, 'ZPAY_WECHAT_H5', 'ZPAY-PW-3', 'user-charlie', $9, $9, 'Charlie message', 'Charlie message', 1500, 1500, 0, 'REFUNDED', NULL, NULL, NULL, $10, NULL, NULL, $10, $10)`,
      [
        bobPledgeId,
        `${prefix}-ORDER-BOB`,
        `${prefix}-Bob`,
        alicePledgeId,
        `${prefix}-ORDER-ALICE`,
        `${prefix}-Alice`,
        charliePledgeId,
        `${prefix}-ORDER-CHARLIE`,
        `${prefix}-Charlie`,
        paidAt,
      ],
    );
    await pool.query(
      `INSERT INTO expenses (
        id, title, amount_fen, description, detail_visibility, created_by, voided_at, voided_by, void_reason, created_at, updated_at
      ) VALUES
        ($1, $2, 700, 'Public hosting invoice', 'PUBLIC', 'playwright', NULL, NULL, NULL, $5, $5),
        ($3, $4, 300, 'Internal tooling note', 'AUDIT_ONLY', 'playwright', NULL, NULL, NULL, $5, $5)`,
      [
        publicExpenseId,
        `${prefix} Hosting`,
        auditExpenseId,
        `${prefix} Internal`,
        now,
      ],
    );
    await pool.query(
      `INSERT INTO expense_evidence (
        id, expense_id, asset_url, file_name, label, sort_order, visibility, uploaded_by, created_at, updated_at
      ) VALUES
        ($1, $2, 'https://picsum.photos/seed/pw-public/900/600', 'public.png', 'Public receipt', 1, 'PUBLIC', 'playwright', $4, $4),
        ($3, $2, 'https://picsum.photos/seed/pw-audit/900/600', 'audit.png', 'Audit receipt', 2, 'AUDIT_ONLY', 'playwright', $4, $4)`,
      [publicEvidenceId, publicExpenseId, auditEvidenceId, now],
    );

    try {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "资金池总览" }),
      ).toBeVisible();
      await expect(page.getByText("当前状态：关闭中")).toBeVisible();
      await expect(page.getByText("¥ 18.00")).toBeVisible();
      await expect(page.getByText("¥ 45.00")).toBeVisible();
      await expect(page.getByText("¥ 10.00")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "众筹已关闭" }),
      ).toBeVisible();

      await page.goto("/pledges");
      await expect(
        page.getByRole("heading", { name: "众筹记录" }),
      ).toBeVisible();
      await expect(page.getByText(`${prefix}-Bob`)).toBeVisible();
      await expect(page.getByText(`${prefix}-Alice`)).toBeVisible();
      await expect(page.getByText("已部分退款")).toBeVisible();
      await expect(page.getByText(`${prefix}-Charlie`)).toHaveCount(0);

      await page.goto("/expenses");
      await expect(
        page.getByRole("heading", { name: "支出明细" }),
      ).toBeVisible();
      await expect(page.getByText(`${prefix} Hosting`)).toBeVisible();
      await expect(page.getByText(`${prefix} Internal`)).toBeVisible();

      await page.goto(`/expenses/${publicExpenseId}`);
      await expect(
        page.getByRole("heading", { name: `${prefix} Hosting` }),
      ).toBeVisible();
      await expect(page.locator("img")).toHaveCount(1);
      await expect(page.getByText("Public receipt")).toBeVisible();

      await page.goto(`/expenses/${auditExpenseId}`);
      await expect(
        page.getByRole("heading", { name: `${prefix} Internal` }),
      ).toBeVisible();
      await expect(page.getByText("暂无公开凭证")).toBeVisible();
    } finally {
      await pool.query(
        `DELETE FROM expense_evidence WHERE id = ANY($1::text[])`,
        [[publicEvidenceId, auditEvidenceId]],
      );
      await pool.query(
        `DELETE FROM expenses WHERE id = ANY($1::text[])`,
        [[publicExpenseId, auditExpenseId]],
      );
      await pool.query(
        `DELETE FROM pledges WHERE id = ANY($1::text[])`,
        [[bobPledgeId, alicePledgeId, charliePledgeId]],
      );
      await pool.query(`DELETE FROM campaign_state WHERE id = $1`, [campaignId]);
    }
  });
});
