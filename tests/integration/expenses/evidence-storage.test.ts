import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  createAdminExpense,
  updateAdminExpenseEvidence,
} from "@/src/application/admin";
import { getExpenseDetail } from "@/src/application/public";
import { createMinioEvidenceStorage } from "@/src/infrastructure/storage";
import { createExpenseRepository } from "@/src/infrastructure/persistence/repositories";

const migrationsDirectory = fileURLToPath(
  new URL("../../../src/infrastructure/persistence/migrations", import.meta.url),
);

type TestContext = Awaited<ReturnType<typeof createTestContext>>;

async function applyMigrations(queryable: { query(text: string): Promise<unknown> }) {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(join(migrationsDirectory, migrationFile), "utf8");
    await queryable.query(sql);
  }
}

async function createTestContext() {
  const schemaName = `cf_expense_${randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);
  await applyMigrations(client);

  return {
    schemaName,
    pool,
    client,
    expenses: createExpenseRepository(client),
  };
}

async function destroyTestContext(context: TestContext) {
  try {
    await context.client.query('SET search_path TO "public"');
    await context.client.query(`DROP SCHEMA IF EXISTS "${context.schemaName}" CASCADE`);
  } finally {
    context.client.release();
    await context.pool.end();
  }
}

describe("expense evidence storage", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    if (context) {
      await destroyTestContext(context);
      context = undefined;
    }
  });

  it("creates signed MinIO upload targets with stable public asset URLs", () => {
    const storage = createMinioEvidenceStorage({
      endpoint: "https://minio.example.com",
      bucket: "expense-assets",
      region: "us-east-1",
      accessKeyId: "minio-access",
      secretAccessKey: "minio-secret",
      publicAssetBaseUrl: "https://assets.example.com",
      now: () => new Date("2026-05-10T12:00:00.000Z"),
    });

    const target = storage.createUploadTarget({
      fileName: "receipt image.png",
      contentType: "image/png",
      prefix: "expense-evidence/test",
      expiresInSeconds: 600,
    });
    const uploadUrl = new URL(target.uploadUrl);

    expect(target.objectKey).toContain("expense-evidence/test/2026/05/10/");
    expect(target.objectKey).toContain("receipt-image.png");
    expect(target.assetUrl).toContain("https://assets.example.com/expense-evidence/test/2026/05/10/");
    expect(uploadUrl.origin).toBe("https://minio.example.com");
    expect(uploadUrl.pathname).toContain("/expense-assets/expense-evidence/test/2026/05/10/");
    expect(uploadUrl.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(uploadUrl.searchParams.get("X-Amz-Credential")).toBe(
      "minio-access/20260510/us-east-1/s3/aws4_request",
    );
    expect(uploadUrl.searchParams.get("X-Amz-Date")).toBe("20260510T120000Z");
    expect(uploadUrl.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(uploadUrl.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(target.headers).toEqual({
      "content-type": "image/png",
    });
  });

  it("persists evidence metadata, allows visibility changes, and hides audit-only assets publicly", async () => {
    const expense = await createAdminExpense(
      {
        title: "Receipt-backed hosting",
        amount: "12.34",
        description: "Hosting bill",
        detailVisibility: "PUBLIC",
        createdBy: "admin",
        evidence: [
          {
            assetUrl: "https://assets.example.com/public.png",
            fileName: "public.png",
            label: "Public receipt",
            sortOrder: 2,
            visibility: "PUBLIC",
          },
          {
            assetUrl: "https://assets.example.com/private.png",
            fileName: "private.png",
            label: "Internal note",
            sortOrder: 1,
            visibility: "AUDIT_ONLY",
          },
        ],
      },
      {
        expenses: context.expenses,
      },
    );

    const auditOnlyEvidence = expense.evidence.find(
      (entry) => entry.visibility === "AUDIT_ONLY",
    )!;
    await updateAdminExpenseEvidence(
      {
        id: auditOnlyEvidence.id,
        label: "Now public receipt",
        sortOrder: 0,
        visibility: "PUBLIC",
      },
      {
        expenses: context.expenses,
      },
    );

    const adminDetail = await context.expenses.getDetail(expense.id);
    const publicDetail = await getExpenseDetail(expense.id, {
      expenses: context.expenses,
    });

    expect(adminDetail?.evidence).toHaveLength(2);
    expect(publicDetail?.evidence).toEqual([
      expect.objectContaining({
        fileName: "private.png",
        label: "Now public receipt",
        sortOrder: 0,
        visibility: "PUBLIC",
      }),
      expect.objectContaining({
        fileName: "public.png",
        label: "Public receipt",
        visibility: "PUBLIC",
      }),
    ]);
  });
});
