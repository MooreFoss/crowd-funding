import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCampaignStateRepository, createExpenseRepository, createPledgeRepository } from "@/src/infrastructure/persistence/repositories";
import { getDatabasePool } from "@/src/infrastructure/persistence/client";
import { getExpenseDetail, getSummary, listExpenses, listPledges } from "@/src/application/public";

const migrationsDirectory = fileURLToPath(
  new URL("../../src/infrastructure/persistence/migrations", import.meta.url),
);

type PublicReadTestContext = Awaited<ReturnType<typeof createTestContext>>;

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
  const schemaName = `cf_public_${randomUUID().replaceAll("-", "")}`;
  const client = await getDatabasePool().connect();

  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);
  await applyMigrations(client);

  return {
    schemaName,
    client,
    campaignState: createCampaignStateRepository(client),
    expenses: createExpenseRepository(client),
    pledges: createPledgeRepository(client),
  };
}

async function destroyTestContext(context: PublicReadTestContext) {
  try {
    await context.client.query('SET search_path TO "public"');
    await context.client.query(`DROP SCHEMA IF EXISTS "${context.schemaName}" CASCADE`);
  } finally {
    context.client.release();
  }
}

describe("public read model services", () => {
  let context: PublicReadTestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await destroyTestContext(context);
  });

  it("returns summary metrics and closed-state sponsor lockout", async () => {
    const firstPledge = await context.pledges.createPending({
      merchantOrderNo: "PUBLIC-ORDER-1",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-a",
      submittedName: "Alice",
      publicName: "Alice",
      submittedMessage: "Keep going",
      publicMessage: "Keep going",
      amountFen: 5_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });
    const secondPledge = await context.pledges.createPending({
      merchantOrderNo: "PUBLIC-ORDER-2",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-b",
      submittedName: null,
      publicName: "匿名用户",
      submittedMessage: null,
      publicMessage: null,
      amountFen: 2_500,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });

    await context.pledges.markPaymentOutcome({
      merchantOrderNo: firstPledge.merchantOrderNo,
      providerOrderNo: "ZPAY-PUBLIC-1",
      status: "PAID",
      paidAt: new Date("2026-05-10T04:00:00.000Z"),
    });
    await context.pledges.markPaymentOutcome({
      merchantOrderNo: secondPledge.merchantOrderNo,
      providerOrderNo: "ZPAY-PUBLIC-2",
      status: "PAID",
      paidAt: new Date("2026-05-10T04:01:00.000Z"),
    });
    await context.pledges.applySuccessfulRefund({
      pledgeId: secondPledge.id,
      amountFen: 500,
    });

    await context.expenses.create({
      title: "Infra",
      amountFen: 1_200,
      description: "Hosting",
      detailVisibility: "PUBLIC",
      createdBy: "admin",
    });
    await context.campaignState.save({
      id: "default",
      status: "CLOSING",
      closeReason: "No new pledges",
      closeSnapshot: null,
      closeSnapshotAt: null,
      closedAt: new Date("2026-05-10T04:10:00.000Z"),
      closedBy: "admin",
      refundBatchNo: null,
      refundProgress: null,
      settledAt: null,
    });

    const summary = await getSummary({
      repositories: {
        campaignState: context.campaignState,
        expenses: context.expenses,
        pledges: context.pledges,
      },
    });

    expect(summary.campaignStatus).toBe("CLOSING");
    expect(summary.canSponsor).toBe(false);
    expect(summary.totalRaisedFen).toBe(7_500);
    expect(summary.totalExpenseFen).toBe(1_200);
    expect(summary.balanceFen).toBe(5_800);
    expect(summary.sponsorCount).toBe(2);
  });

  it("returns pagination-ready public pledges without fully refunded rows", async () => {
    const pledgeOne = await context.pledges.createPending({
      merchantOrderNo: "PUBLIC-LIST-1",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-1",
      submittedName: "Alice",
      publicName: "Alice",
      submittedMessage: "First",
      publicMessage: "First",
      amountFen: 1_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });
    const pledgeTwo = await context.pledges.createPending({
      merchantOrderNo: "PUBLIC-LIST-2",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-2",
      submittedName: "Bob",
      publicName: "Bob",
      submittedMessage: "",
      publicMessage: "",
      amountFen: 2_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });
    const pledgeThree = await context.pledges.createPending({
      merchantOrderNo: "PUBLIC-LIST-3",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-3",
      submittedName: null,
      publicName: "匿名用户",
      submittedMessage: null,
      publicMessage: null,
      amountFen: 3_000,
      paymentRedirectUrl: null,
      termsVersionId: null,
      termsAcceptedAt: null,
    });

    await context.pledges.markPaymentOutcome({
      merchantOrderNo: pledgeOne.merchantOrderNo,
      providerOrderNo: "ZPAY-LIST-1",
      status: "PAID",
      paidAt: new Date("2026-05-10T05:00:00.000Z"),
    });
    await context.pledges.markPaymentOutcome({
      merchantOrderNo: pledgeTwo.merchantOrderNo,
      providerOrderNo: "ZPAY-LIST-2",
      status: "PAID",
      paidAt: new Date("2026-05-10T05:01:00.000Z"),
    });
    await context.pledges.markPaymentOutcome({
      merchantOrderNo: pledgeThree.merchantOrderNo,
      providerOrderNo: "ZPAY-LIST-3",
      status: "PAID",
      paidAt: new Date("2026-05-10T05:02:00.000Z"),
    });
    await context.pledges.applySuccessfulRefund({
      pledgeId: pledgeThree.id,
      amountFen: 3_000,
    });

    const page = await listPledges(
      { limit: 2, offset: 0 },
      { pledges: context.pledges },
    );

    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.displayName)).toEqual(["Bob", "Alice"]);
    expect(page.page.hasMore).toBe(false);
  });

  it("returns public expenses and public-safe expense detail", async () => {
    const publicExpense = await context.expenses.create({
      title: "Hosting",
      amountFen: 800,
      description: "Cloud hosting",
      detailVisibility: "PUBLIC",
      createdBy: "admin",
    });
    const auditOnlyExpense = await context.expenses.create({
      title: "Internal tool",
      amountFen: 300,
      description: "Private ops",
      detailVisibility: "AUDIT_ONLY",
      createdBy: "admin",
    });

    await context.expenses.addEvidence({
      expenseId: publicExpense.id,
      assetUrl: "https://assets.example.com/public-1.png",
      fileName: "public-1.png",
      label: "Public evidence",
      sortOrder: 1,
      visibility: "PUBLIC",
      uploadedBy: "admin",
    });
    await context.expenses.addEvidence({
      expenseId: publicExpense.id,
      assetUrl: "https://assets.example.com/private-1.png",
      fileName: "private-1.png",
      label: "Audit evidence",
      sortOrder: 2,
      visibility: "AUDIT_ONLY",
      uploadedBy: "admin",
    });

    const listPage = await listExpenses(
      { limit: 10, offset: 0 },
      { expenses: context.expenses },
    );
    const publicDetail = await getExpenseDetail(publicExpense.id, {
      expenses: context.expenses,
    });
    const auditOnlyDetail = await getExpenseDetail(auditOnlyExpense.id, {
      expenses: context.expenses,
    });

    expect(listPage.items).toHaveLength(2);
    expect(publicDetail?.evidence).toHaveLength(1);
    expect(publicDetail?.detailVisibility).toBe("PUBLIC");
    expect(auditOnlyDetail?.evidence).toHaveLength(0);
    expect(auditOnlyDetail?.detailVisibility).toBe("AUDIT_ONLY");
  });
});
