import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabasePool } from "@/src/infrastructure/persistence/client";
import {
  createAuditLogRepository,
  createCampaignStateRepository,
  createExpenseRepository,
  createModerationReviewRepository,
  createPledgeRepository,
  createRefundRepository,
  createTermsRepository,
} from "@/src/infrastructure/persistence/repositories";

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
  const schemaName = `cf_${randomUUID().replaceAll("-", "")}`;
  const client = await getDatabasePool().connect();

  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);
  await applyMigrations(client);

  return {
    schemaName,
    client,
    auditLogs: createAuditLogRepository(client),
    campaignState: createCampaignStateRepository(client),
    expenses: createExpenseRepository(client),
    moderationReviews: createModerationReviewRepository(client),
    pledges: createPledgeRepository(client),
    refunds: createRefundRepository(client),
    terms: createTermsRepository(client),
  };
}

async function destroyTestContext(context: TestContext) {
  try {
    await context.client.query('SET search_path TO "public"');
    await context.client.query(`DROP SCHEMA IF EXISTS "${context.schemaName}" CASCADE`);
  } finally {
    context.client.release();
  }
}

describe("core persistence repositories", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await destroyTestContext(context);
  });

  it("creates and reads core lifecycle records", async () => {
    const terms = await context.terms.create({
      version: "v1.0.0",
      title: "Crowdfunding Terms",
      body: "Terms body",
      status: "DRAFT",
      createdBy: "admin",
    });
    const activeTerms = await context.terms.publish({
      id: terms.id,
      publishedAt: new Date("2026-05-10T01:00:00.000Z"),
    });

    const pendingPledge = await context.pledges.createPending({
      merchantOrderNo: "ORDER-1001",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-001",
      submittedName: "Alice",
      publicName: "Alice",
      submittedMessage: "Thanks for building this.",
      publicMessage: "Thanks for building this.",
      amountFen: 5_000,
      paymentRedirectUrl: "https://zpay.example.com/h5/1001",
      termsVersionId: activeTerms.id,
      termsAcceptedAt: new Date("2026-05-10T01:05:00.000Z"),
    });

    const paidPledge = await context.pledges.markPaymentOutcome({
      merchantOrderNo: pendingPledge.merchantOrderNo,
      providerOrderNo: "ZPAY-ORDER-1001",
      status: "PAID",
      paidAt: new Date("2026-05-10T01:06:00.000Z"),
    });

    const moderationReview = await context.moderationReviews.create({
      subjectType: "PLEDGE",
      subjectId: paidPledge.id,
      fieldName: "DISPLAY_NAME",
      status: "APPROVED",
      submittedText: "Alice",
      requestId: "tms-1001",
      reviewedAt: new Date("2026-05-10T01:07:00.000Z"),
    });

    const expense = await context.expenses.create({
      title: "Cloud hosting",
      amountFen: 1_200,
      description: "Production infrastructure",
      detailVisibility: "PUBLIC",
      createdBy: "admin",
    });
    await context.expenses.addEvidence({
      expenseId: expense.id,
      assetUrl: "https://assets.example.com/evidence/public.png",
      fileName: "public.png",
      label: "Receipt",
      sortOrder: 1,
      visibility: "PUBLIC",
      uploadedBy: "admin",
    });
    await context.expenses.addEvidence({
      expenseId: expense.id,
      assetUrl: "https://assets.example.com/evidence/internal.png",
      fileName: "internal.png",
      label: "Internal note",
      sortOrder: 2,
      visibility: "AUDIT_ONLY",
      uploadedBy: "admin",
    });

    const refund = await context.refunds.create({
      pledgeId: paidPledge.id,
      merchantRefundNo: "REFUND-1001",
      amountFen: 500,
      reason: "Partial refund",
      requestedBy: "admin",
      status: "PROCESSING",
    });
    await context.refunds.markStatus({
      merchantRefundNo: refund.merchantRefundNo,
      providerRefundNo: "ZPAY-REFUND-1001",
      status: "SUCCEEDED",
      completedAt: new Date("2026-05-10T02:00:00.000Z"),
    });
    const refundedPledge = await context.pledges.applySuccessfulRefund({
      pledgeId: paidPledge.id,
      amountFen: 500,
    });

    const adminPledge = await context.pledges.findByMerchantOrderNo("ORDER-1001");
    const adminExpenseDetail = await context.expenses.getDetail(expense.id);
    const publicExpenseDetail = await context.expenses.getPublicDetail(
      expense.id,
    );
    const publicExpenses = await context.expenses.listPublic();

    expect(activeTerms.status).toBe("ACTIVE");
    expect(moderationReview.requestId).toBe("tms-1001");
    expect(adminPledge?.providerOrderNo).toBe("ZPAY-ORDER-1001");
    expect(adminPledge?.status).toBe("PARTIAL_REFUNDED");
    expect(refundedPledge.netAmountFen).toBe(4_500);
    expect(publicExpenses).toHaveLength(1);
    expect(adminExpenseDetail?.evidence).toHaveLength(2);
    expect(adminExpenseDetail?.publicEvidence).toHaveLength(1);
    expect(publicExpenseDetail?.evidence).toHaveLength(1);
    expect(publicExpenseDetail?.publicEvidence).toHaveLength(1);
  });

  it("stores idempotent audit events once per idempotency key", async () => {
    const firstInsert = await context.auditLogs.appendIdempotent({
      actorType: "SYSTEM",
      actorId: "zpay",
      action: "PAYMENT_NOTIFICATION",
      targetType: "PLEDGE",
      targetId: "pledge-1",
      idempotencyKey: "zpay:notify:pledge-1",
      metadata: { status: "PAID" },
    });
    const secondInsert = await context.auditLogs.appendIdempotent({
      actorType: "SYSTEM",
      actorId: "zpay",
      action: "PAYMENT_NOTIFICATION",
      targetType: "PLEDGE",
      targetId: "pledge-1",
      idempotencyKey: "zpay:notify:pledge-1",
      metadata: { status: "PAID" },
    });

    const logs = await context.auditLogs.listByTarget({
      targetType: "PLEDGE",
      targetId: "pledge-1",
    });

    expect(firstInsert.inserted).toBe(true);
    expect(secondInsert.inserted).toBe(false);
    expect(secondInsert.record.id).toBe(firstInsert.record.id);
    expect(logs).toHaveLength(1);
  });

  it("keeps the existing active terms version if publish target is missing", async () => {
    const firstTerms = await context.terms.create({
      version: "v1.0.0",
      title: "Initial terms",
      body: "Initial body",
      status: "DRAFT",
      createdBy: "admin",
    });
    const activeTerms = await context.terms.publish({
      id: firstTerms.id,
      publishedAt: new Date("2026-05-10T02:30:00.000Z"),
    });

    await expect(
      context.terms.publish({
        id: "missing-terms-id",
        publishedAt: new Date("2026-05-10T02:31:00.000Z"),
      }),
    ).rejects.toThrow("Terms version missing-terms-id was not found.");

    const stillActiveTerms = await context.terms.findActive();

    expect(activeTerms.id).toBe(firstTerms.id);
    expect(stillActiveTerms?.id).toBe(firstTerms.id);
    expect(stillActiveTerms?.status).toBe("ACTIVE");
  });

  it("persists and retrieves closeout snapshots", async () => {
    await context.pledges.createPending({
      merchantOrderNo: "ORDER-2001",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-100",
      submittedName: null,
      publicName: "匿名用户",
      submittedMessage: null,
      publicMessage: null,
      amountFen: 8_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });
    const secondPending = await context.pledges.createPending({
      merchantOrderNo: "ORDER-2002",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-200",
      submittedName: "Bob",
      publicName: "Bob",
      submittedMessage: "Go go go",
      publicMessage: "Go go go",
      amountFen: 4_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });

    await context.pledges.markPaymentOutcome({
      merchantOrderNo: "ORDER-2001",
      providerOrderNo: "ZPAY-ORDER-2001",
      status: "PAID",
      paidAt: new Date("2026-05-10T03:00:00.000Z"),
    });
    await context.pledges.markPaymentOutcome({
      merchantOrderNo: secondPending.merchantOrderNo,
      providerOrderNo: "ZPAY-ORDER-2002",
      status: "PAID",
      paidAt: new Date("2026-05-10T03:01:00.000Z"),
    });

    await context.campaignState.save({
      id: "default",
      status: "ACTIVE",
      closeReason: null,
      closeSnapshot: null,
      closeSnapshotAt: null,
      closedAt: null,
      closedBy: null,
      refundBatchNo: null,
      refundProgress: null,
      settledAt: null,
    });

    const eligiblePledges = await context.pledges.listEligibleForCloseout();
    const closedState = await context.campaignState.saveCloseSnapshot({
      campaignId: "default",
      closeReason: "Campaign ended",
      closedBy: "admin",
      closedAt: new Date("2026-05-10T03:10:00.000Z"),
      snapshot: {
        snapshotId: "snapshot-1",
        capturedAt: "2026-05-10T03:10:00.000Z",
        totalEligibleNetFen: eligiblePledges.reduce(
          (total, pledge) => total + pledge.netAmountFen,
          0,
        ),
        pledges: eligiblePledges.map((pledge) => ({
          pledgeId: pledge.id,
          merchantOrderNo: pledge.merchantOrderNo,
          netAmountFen: pledge.netAmountFen,
          userKey: pledge.userKey,
        })),
      },
    });

    const reloadedState = await context.campaignState.findById("default");

    expect(closedState.status).toBe("CLOSING");
    expect(reloadedState?.closeSnapshot?.snapshotId).toBe("snapshot-1");
    expect(reloadedState?.closeSnapshot?.pledges).toHaveLength(2);
    expect(reloadedState?.closeSnapshot?.totalEligibleNetFen).toBe(12_000);
  });

  it("upserts campaign state for idempotent state transitions", async () => {
    await context.campaignState.save({
      id: "default",
      status: "ACTIVE",
      closeReason: null,
      closeSnapshot: null,
      closeSnapshotAt: null,
      closedAt: null,
      closedBy: null,
      refundBatchNo: null,
      refundProgress: null,
      settledAt: null,
    });

    const updatedState = await context.campaignState.updateRefundProgress({
      campaignId: "default",
      status: "REFUNDING",
      refundBatchNo: "batch-1",
      refundProgress: { processed: 1, failed: 0 },
      settledAt: null,
    });
    const rowCount = await context.client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM campaign_state",
    );

    expect(updatedState.status).toBe("REFUNDING");
    expect(updatedState.refundBatchNo).toBe("batch-1");
    expect(updatedState.refundProgress).toEqual({ processed: 1, failed: 0 });
    expect(rowCount.rows[0]?.count).toBe(1);
  });
});
