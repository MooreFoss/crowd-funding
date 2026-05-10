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
    throw new Error("DATABASE_URL is required for Playwright expense tests.");
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

test.describe("expense evidence", () => {
  const pool = new Pool({
    connectionString: withSchemaSearchPath(
      readDatabaseUrl(),
      readDatabaseSchema(),
    ),
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test("shows public evidence previews and hides audit-only images", async ({
    page,
  }) => {
    const prefix = `PW-EVIDENCE-${randomUUID().slice(0, 8)}`;
    const expenseId = `${prefix}-expense`;
    const emptyExpenseId = `${prefix}-empty`;
    const now = new Date("2026-05-10T12:00:00.000Z");
    const publicAssetUrl = `https://assets.example.com/${prefix}/public.png`;
    const privateAssetUrl = `https://assets.example.com/${prefix}/private.png`;

    await pool.query(
      `INSERT INTO expenses (
        id, title, amount_fen, description, detail_visibility, created_by, created_at, updated_at
      ) VALUES
        ($1, $2, 1234, 'Public evidence should be visible', 'PUBLIC', 'playwright', $4, $4),
        ($3, $5, 800, 'No public images', 'PUBLIC', 'playwright', $4, $4)`,
      [
        expenseId,
        `${prefix} Hosting`,
        emptyExpenseId,
        now,
        `${prefix} Empty`,
      ],
    );
    await pool.query(
      `INSERT INTO expense_evidence (
        id, expense_id, asset_url, file_name, label, sort_order, visibility, uploaded_by, created_at, updated_at
      ) VALUES
        ($1, $2, $3, 'public.png', $4, 1, 'PUBLIC', 'playwright', $7, $7),
        ($5, $2, $6, 'private.png', $8, 2, 'AUDIT_ONLY', 'playwright', $7, $7)`,
      [
        `${prefix}-public`,
        expenseId,
        publicAssetUrl,
        `${prefix} Public receipt`,
        `${prefix}-private`,
        privateAssetUrl,
        now,
        `${prefix} Private receipt`,
      ],
    );

    try {
      await page.goto(`/expenses/${expenseId}`);

      await expect(
        page.getByRole("heading", { name: `${prefix} Hosting` }),
      ).toBeVisible();
      await expect(page.getByText(`${prefix} Public receipt`)).toBeVisible();
      await expect(
        page.getByRole("img", { name: `${prefix} Public receipt` }),
      ).toBeVisible();
      await expect(page.getByText(`${prefix} Private receipt`)).toHaveCount(0);
      await expect(page.getByRole("link", { name: /Public receipt/ })).toHaveAttribute(
        "href",
        publicAssetUrl,
      );

      await page.goto(`/expenses/${emptyExpenseId}`);
      await expect(page.getByText("暂无公开凭证")).toBeVisible();
    } finally {
      await pool.query(`DELETE FROM expense_evidence WHERE expense_id = ANY($1::text[])`, [
        [expenseId, emptyExpenseId],
      ]);
      await pool.query(`DELETE FROM expenses WHERE id = ANY($1::text[])`, [
        [expenseId, emptyExpenseId],
      ]);
    }
  });
});
