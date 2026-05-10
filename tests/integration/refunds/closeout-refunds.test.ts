import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import {
  closeCampaign,
  confirmRefundNotification,
  createBatchRefund,
  createSingleRefund,
  type RefundGateway,
} from "@/src/application/refunds";
import {
  createCampaignStateRepository,
  createExpenseRepository,
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
  const schemaName = `cf_refund_${randomUUID().replaceAll("-", "")}`;
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
    campaignState: createCampaignStateRepository(client),
    expenses: createExpenseRepository(client),
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
    await context.pool.end();
  }
}

function createRefundGateway(): RefundGateway & {
  createRefund: ReturnType<typeof vi.fn>;
} {
  return {
    createRefund: vi.fn(async (input) => ({
      providerRefundNo: `ZPAY-${input.merchantRefundNo}`,
      accepted: true,
    })),
  };
}

async function createPaidPledge(
  context: TestContext,
  input: {
    merchantOrderNo: string;
    amountFen: number;
    userKey: string;
  },
) {
  const pledge = await context.pledges.createPending({
    merchantOrderNo: input.merchantOrderNo,
    paymentChannel: "ZPAY_WECHAT_H5",
    userKey: input.userKey,
    submittedName: input.userKey,
    publicName: input.userKey,
    submittedMessage: null,
    publicMessage: null,
    amountFen: input.amountFen,
    paymentRedirectUrl: null,
    termsVersionId: null,
    termsAcceptedAt: null,
  });

  return context.pledges.markPaymentOutcome({
    merchantOrderNo: pledge.merchantOrderNo,
    providerOrderNo: `ZPAY-${pledge.merchantOrderNo}`,
    status: "PAID",
    paidAt: new Date("2026-05-10T10:00:00.000Z"),
  });
}

describe("refunds and closeout integration", () => {
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

  it("handles partial refund, full refund, over-refund rejection, and idempotent callbacks", async () => {
    const gateway = createRefundGateway();
    const pledge = await createPaidPledge(context, {
      merchantOrderNo: "REFUND-ORDER-1",
      amountFen: 1_000,
      userKey: "refund-user",
    });

    const partialRefund = await createSingleRefund(
      {
        pledgeId: pledge.id,
        amount: "3.00",
        reason: "Partial refund",
        requestedBy: "admin",
      },
      {
        gateway,
        merchantRefundNoFactory: () => "RF-PARTIAL-1",
        repositories: {
          pledges: context.pledges,
          refunds: context.refunds,
        },
      },
    );

    expect(partialRefund).toMatchObject({
      merchantRefundNo: "RF-PARTIAL-1",
      amountFen: 300,
      status: "PROCESSING",
    });

    await confirmRefundNotification(
      {
        merchantRefundNo: "RF-PARTIAL-1",
        providerRefundNo: "ZPAY-RF-PARTIAL-1",
        status: "SUCCEEDED",
      },
      {
        pledges: context.pledges,
        refunds: context.refunds,
      },
    );
    await confirmRefundNotification(
      {
        merchantRefundNo: "RF-PARTIAL-1",
        providerRefundNo: "ZPAY-RF-PARTIAL-1",
        status: "SUCCEEDED",
      },
      {
        pledges: context.pledges,
        refunds: context.refunds,
      },
    );

    expect(await context.pledges.findById(pledge.id)).toMatchObject({
      refundedFen: 300,
      netAmountFen: 700,
      status: "PARTIAL_REFUNDED",
    });

    await expect(
      createSingleRefund(
        {
          pledgeId: pledge.id,
          amount: "7.01",
          reason: "Too much",
          requestedBy: "admin",
        },
        {
          gateway,
          repositories: {
            pledges: context.pledges,
            refunds: context.refunds,
          },
        },
      ),
    ).rejects.toThrow("exceeds");

    await createSingleRefund(
      {
        pledgeId: pledge.id,
        amount: "7.00",
        reason: "Full remaining refund",
        requestedBy: "admin",
      },
      {
        gateway,
        merchantRefundNoFactory: () => "RF-FULL-1",
        repositories: {
          pledges: context.pledges,
          refunds: context.refunds,
        },
      },
    );
    await confirmRefundNotification(
      {
        merchantRefundNo: "RF-FULL-1",
        providerRefundNo: "ZPAY-RF-FULL-1",
        status: "SUCCEEDED",
      },
      {
        pledges: context.pledges,
        refunds: context.refunds,
      },
    );

    expect(await context.pledges.findById(pledge.id)).toMatchObject({
      refundedFen: 1_000,
      netAmountFen: 0,
      status: "REFUNDED",
    });
  });

  it("freezes closeout snapshots and creates retry-safe proportional child refunds", async () => {
    const gateway = createRefundGateway();
    await createPaidPledge(context, {
      merchantOrderNo: "CLOSEOUT-ORDER-1",
      amountFen: 8_000,
      userKey: "user-a",
    });
    await createPaidPledge(context, {
      merchantOrderNo: "CLOSEOUT-ORDER-2",
      amountFen: 4_000,
      userKey: "user-b",
    });
    await context.expenses.create({
      title: "Spent funds",
      amountFen: 2_000,
      description: "Already spent",
      detailVisibility: "PUBLIC",
      createdBy: "admin",
    });

    const closed = await closeCampaign(
      {
        closeReason: "Campaign complete",
        closedBy: "admin",
        closedAt: new Date("2026-05-10T12:00:00.000Z"),
      },
      {
        campaignState: context.campaignState,
        expenses: context.expenses,
        pledges: context.pledges,
      },
    );

    expect(closed).toMatchObject({
      status: "CLOSING",
      closeReason: "Campaign complete",
    });
    expect(closed.closeSnapshot).toMatchObject({
      totalEligibleNetFen: 12_000,
      totalExpenseFen: 2_000,
      refundableBalanceFen: 10_000,
    });

    const batch = await createBatchRefund(
      {
        requestedBy: "admin",
        batchNo: "BATCH-CLOSEOUT-1",
      },
      {
        gateway,
        repositories: {
          campaignState: context.campaignState,
          refunds: context.refunds,
        },
      },
    );
    const secondRun = await createBatchRefund(
      {
        requestedBy: "admin",
        batchNo: "BATCH-CLOSEOUT-1",
      },
      {
        gateway,
        repositories: {
          campaignState: context.campaignState,
          refunds: context.refunds,
        },
      },
    );
    const childRefunds = await context.refunds.listByBatchNo("BATCH-CLOSEOUT-1");
    const campaign = await context.campaignState.findById("default");

    expect(batch.createdCount).toBe(2);
    expect(secondRun).toMatchObject({
      createdCount: 0,
      skippedExisting: true,
    });
    expect(childRefunds.map((refund) => refund.amountFen)).toEqual([6_667, 3_333]);
    expect(gateway.createRefund).toHaveBeenCalledTimes(2);
    expect(campaign).toMatchObject({
      status: "REFUNDING",
      refundBatchNo: "BATCH-CLOSEOUT-1",
    });
  });
});
