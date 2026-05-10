import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { listAuditLogs } from "@/src/application/admin";
import { createSingleRefund, type RefundGateway } from "@/src/application/refunds";
import { logAuditEventIdempotent } from "@/src/infrastructure/audit";
import {
  createAuditLogRepository,
  createPledgeRepository,
  createRefundRepository,
} from "@/src/infrastructure/persistence/repositories";

const migrationsDirectory = fileURLToPath(
  new URL("../../src/infrastructure/persistence/migrations", import.meta.url),
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
  const schemaName = `cf_audit_${randomUUID().replaceAll("-", "")}`;
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
    auditLogs: createAuditLogRepository(client),
    pledges: createPledgeRepository(client),
    refunds: createRefundRepository(client),
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

const gateway: RefundGateway = {
  async createRefund(input) {
    return {
      providerRefundNo: `ZPAY-${input.merchantRefundNo}`,
      accepted: true,
    };
  },
};

describe("audit logs", () => {
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

  it("creates idempotent logs and supports filtered retrieval", async () => {
    await logAuditEventIdempotent(
      {
        actorType: "SYSTEM",
        actorId: "zpay",
        action: "PAYMENT_NOTIFICATION",
        targetType: "PLEDGE",
        targetId: "pledge-1",
        metadata: { status: "PAID" },
        idempotencyKey: "payment:pledge-1:paid",
      },
      {
        auditLogs: context.auditLogs,
      },
    );
    await logAuditEventIdempotent(
      {
        actorType: "SYSTEM",
        actorId: "zpay",
        action: "PAYMENT_NOTIFICATION",
        targetType: "PLEDGE",
        targetId: "pledge-1",
        metadata: { status: "PAID" },
        idempotencyKey: "payment:pledge-1:paid",
      },
      {
        auditLogs: context.auditLogs,
      },
    );

    const logs = await listAuditLogs(
      {
        targetType: "PLEDGE",
        targetId: "pledge-1",
      },
      {
        auditLogs: context.auditLogs,
      },
    );

    expect(logs.items).toHaveLength(1);
    expect(logs.items[0]).toMatchObject({
      action: "PAYMENT_NOTIFICATION",
      targetType: "PLEDGE",
      targetId: "pledge-1",
    });
  });

  it("emits structured audit events from refund use cases", async () => {
    const pledge = await context.pledges.createPending({
      merchantOrderNo: "AUDIT-REFUND-ORDER",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "audit-user",
      submittedName: "Audit",
      publicName: "Audit",
      submittedMessage: null,
      publicMessage: null,
      amountFen: 1_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });
    const paid = await context.pledges.markPaymentOutcome({
      merchantOrderNo: pledge.merchantOrderNo,
      providerOrderNo: "ZPAY-AUDIT",
      status: "PAID",
      paidAt: new Date("2026-05-10T12:00:00.000Z"),
    });

    const refund = await createSingleRefund(
      {
        pledgeId: paid.id,
        amount: "1.00",
        reason: "Audit refund",
        requestedBy: "admin",
      },
      {
        gateway,
        merchantRefundNoFactory: () => "RF-AUDIT-1",
        repositories: {
          auditLogs: context.auditLogs,
          pledges: context.pledges,
          refunds: context.refunds,
        },
      },
    );
    const logs = await listAuditLogs(
      {
        action: "SINGLE_REFUND_REQUESTED",
      },
      {
        auditLogs: context.auditLogs,
      },
    );

    expect(refund.status).toBe("PROCESSING");
    expect(logs.items[0]).toMatchObject({
      actorType: "ADMIN",
      actorId: "admin",
      action: "SINGLE_REFUND_REQUESTED",
      targetType: "REFUND",
    });
  });
});
