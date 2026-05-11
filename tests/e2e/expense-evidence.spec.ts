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

  test("uploads expense evidence through MinIO before saving metadata", async ({
    page,
  }) => {
    const prefix = `PW-UPLOAD-${randomUUID().slice(0, 8)}`;
    const expenseId = `${prefix}-expense`;
    const now = new Date("2026-05-10T12:30:00.000Z");
    const assetUrl = `https://assets.example.com/${prefix}/invoice.pdf`;
    let uploadTargetRequested = false;
    let uploadedContentType: string | null = null;

    await pool.query(
      `INSERT INTO expenses (
        id, title, amount_fen, description, detail_visibility, created_by, created_at, updated_at
      ) VALUES ($1, $2, 4321, 'Needs uploaded evidence', 'PUBLIC', 'playwright', $3, $3)`,
      [expenseId, `${prefix} Upload target`, now],
    );

    await page.route("**/api/admin/expenses/evidence/upload-url", async (route) => {
      const request = route.request();
      const payload = request.postDataJSON() as {
        fileName?: string;
        contentType?: string;
      };

      uploadTargetRequested =
        payload.fileName === "invoice.pdf" &&
        payload.contentType === "application/pdf";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          objectKey: `${prefix}/invoice.pdf`,
          uploadUrl: `https://minio.example.com/${prefix}/invoice.pdf`,
          assetUrl,
          headers: {
            "content-type": "application/pdf",
          },
          expiresAt: "2026-05-10T12:45:00.000Z",
        }),
      });
    });
    await page.route("https://minio.example.com/**", async (route) => {
      uploadedContentType = route.request().headers()["content-type"] ?? null;
      await route.fulfill({ status: 200, body: "" });
    });

    try {
      const response = await page.request.post("/api/admin/session", {
        data: {
          username: "test-admin",
          password: "test-password",
        },
      });

      expect(response.status()).toBe(200);
      await page.goto("/admin/expenses");

      const expenseCard = page.locator("article").filter({
        hasText: `${prefix} Upload target`,
      });

      await expenseCard
        .getByLabel("上传凭证")
        .setInputFiles({
          name: "invoice.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 test invoice"),
        });
      await expenseCard.getByLabel("凭证标签").fill(`${prefix} PDF invoice`);
      await expenseCard.getByRole("button", { name: "添加凭证" }).click();
      await expect(page).toHaveURL(/\/admin\/expenses$/);
      await expect(page.getByRole("link", { name: `${prefix} PDF invoice` })).toHaveAttribute(
        "href",
        assetUrl,
      );

      const savedEvidence = await pool.query<{
        asset_url: string;
        file_name: string;
        label: string;
      }>(
        `SELECT asset_url, file_name, label
         FROM expense_evidence
         WHERE expense_id = $1`,
        [expenseId],
      );

      expect(uploadTargetRequested).toBe(true);
      expect(uploadedContentType).toBe("application/pdf");
      expect(savedEvidence.rows).toEqual([
        {
          asset_url: assetUrl,
          file_name: "invoice.pdf",
          label: `${prefix} PDF invoice`,
        },
      ]);
    } finally {
      await pool.query(`DELETE FROM expense_evidence WHERE expense_id = $1`, [
        expenseId,
      ]);
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
      await pool.query(
        `DELETE FROM audit_logs WHERE action = 'ADMIN_LOGIN' AND actor_id = 'test-admin'`,
      );
    }
  });

  test("shows public evidence previews and hides audit-only images", async ({
    page,
  }) => {
    const prefix = `PW-EVIDENCE-${randomUUID().slice(0, 8)}`;
    const expenseId = `${prefix}-expense`;
    const emptyExpenseId = `${prefix}-empty`;
    const now = new Date("2026-05-10T12:00:00.000Z");
    const publicAssetUrl = `https://assets.example.com/${prefix}/public.png`;
    const publicFileUrl = `https://assets.example.com/${prefix}/invoice.pdf`;
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
        ($9, $2, $10, 'invoice.pdf', $11, 2, 'PUBLIC', 'playwright', $7, $7),
        ($5, $2, $6, 'private.png', $8, 3, 'AUDIT_ONLY', 'playwright', $7, $7)`,
      [
        `${prefix}-public`,
        expenseId,
        publicAssetUrl,
        `${prefix} Public receipt`,
        `${prefix}-private`,
        privateAssetUrl,
        now,
        `${prefix} Private receipt`,
        `${prefix}-file`,
        publicFileUrl,
        `${prefix} PDF invoice`,
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
      await expect(page.getByRole("img")).toHaveCount(1);
      await expect(page.getByText(`${prefix} PDF invoice`).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /PDF invoice/ })).toHaveAttribute(
        "href",
        publicFileUrl,
      );
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
