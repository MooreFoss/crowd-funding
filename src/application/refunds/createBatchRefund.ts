import { randomUUID } from "node:crypto";

import {
  allocateProportionalRefunds,
  getCloseoutRefundTotalFen,
  type CampaignCloseSnapshot,
} from "@/src/domain/funding";
import { createConfiguredPaymentGateway } from "@/src/application/payments";

import {
  type RefundGateway,
  type RefundRepositoriesInput,
} from "./createSingleRefund";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import {
  createCampaignStateRepository,
  createExpenseRepository,
  createPledgeRepository,
  createRefundRepository,
} from "@/src/infrastructure/persistence/repositories";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";

const CAMPAIGN_ID = "default";

function resolveBatchRepositories(input?: RefundRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return {
    campaignState:
      input?.campaignState ?? createCampaignStateRepository(executor),
    expenses: input?.expenses ?? createExpenseRepository(executor),
    pledges: input?.pledges ?? createPledgeRepository(executor),
    refunds: input?.refunds ?? createRefundRepository(executor),
  };
}

function createSnapshotId() {
  return `snapshot-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function createBatchNo() {
  return `BATCH-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createBatchRefundNo(batchNo: string, order: number) {
  return `${batchNo}-${String(order).padStart(4, "0")}`;
}

export async function closeCampaign(
  input: {
    closeReason: string;
    closedBy: string;
    closedAt?: Date;
  },
  repositories?: RefundRepositoriesInput,
) {
  const { campaignState, expenses, pledges } =
    resolveBatchRepositories(repositories);
  const existing = await campaignState.findById(CAMPAIGN_ID);

  if (existing?.closeSnapshot) {
    return existing;
  }

  const closeReason = input.closeReason.trim();

  if (!closeReason) {
    throw new Error("Close reason is required.");
  }

  const closedAt = input.closedAt ?? new Date();
  const [eligiblePledges, publicExpenses] = await Promise.all([
    pledges.listEligibleForCloseout(),
    expenses.listPublic(),
  ]);
  const totalEligibleNetFen = eligiblePledges.reduce(
    (total, pledge) => total + pledge.netAmountFen,
    0,
  );
  const totalExpenseFen = publicExpenses.reduce(
    (total, expense) => total + expense.amountFen,
    0,
  );
  const snapshot: CampaignCloseSnapshot = {
    snapshotId: createSnapshotId(),
    capturedAt: closedAt.toISOString(),
    totalEligibleNetFen,
    totalExpenseFen,
    refundableBalanceFen: Math.max(0, totalEligibleNetFen - totalExpenseFen),
    pledges: eligiblePledges.map((pledge) => ({
      pledgeId: pledge.id,
      merchantOrderNo: pledge.merchantOrderNo,
      netAmountFen: pledge.netAmountFen,
      userKey: pledge.userKey,
    })),
  };

  return campaignState.saveCloseSnapshot({
    campaignId: CAMPAIGN_ID,
    closeReason,
    closedBy: input.closedBy,
    closedAt,
    snapshot,
  });
}

export async function createBatchRefund(
  input: {
    requestedBy: string;
    batchNo?: string;
  },
  options: {
    gateway?: RefundGateway;
    repositories?: RefundRepositoriesInput;
  } = {},
) {
  const { campaignState, refunds } = resolveBatchRepositories(
    options.repositories,
  );
  const campaign = await campaignState.findById(CAMPAIGN_ID);

  if (!campaign?.closeSnapshot) {
    throw new Error("Campaign must be closed before batch refunds.");
  }

  const batchNo = campaign.refundBatchNo ?? input.batchNo ?? createBatchNo();
  const existingRefunds = await refunds.listByBatchNo(batchNo);

  if (existingRefunds.length > 0) {
    return {
      batchNo,
      createdCount: 0,
      skippedExisting: true,
      refunds: existingRefunds,
    };
  }

  const totalRefundFen = getCloseoutRefundTotalFen(campaign.closeSnapshot);
  const allocations = allocateProportionalRefunds({
    totalRefundFen,
    pledges: campaign.closeSnapshot.pledges.map((pledge) => ({
      pledgeId: pledge.pledgeId,
      merchantOrderNo: pledge.merchantOrderNo,
      netAmountFen: pledge.netAmountFen,
    })),
  });
  const gateway = options.gateway ?? createConfiguredPaymentGateway();
  const createdRefunds = [];

  for (const allocation of allocations) {
    const merchantRefundNo = createBatchRefundNo(
      batchNo,
      allocation.allocationOrder,
    );
    const created = await refunds.create({
      pledgeId: allocation.pledgeId,
      merchantRefundNo,
      amountFen: allocation.amountFen,
      reason: `Campaign closeout batch ${batchNo}`,
      requestedBy: input.requestedBy,
      status: "CREATED",
      batchNo,
      closeSnapshotId: campaign.closeSnapshot.snapshotId,
      allocationOrder: allocation.allocationOrder,
    });

    try {
      const response = await gateway.createRefund({
        merchantOrderNo: allocation.merchantOrderNo,
        merchantRefundNo,
        amountFen: allocation.amountFen,
        reason: `Campaign closeout batch ${batchNo}`,
      });
      createdRefunds.push(
        await refunds.markStatus({
          merchantRefundNo,
          providerRefundNo: response.providerRefundNo,
          status: response.accepted ? "PROCESSING" : "EXCEPTION",
        }),
      );
    } catch {
      createdRefunds.push(
        await refunds.markStatus({
          merchantRefundNo: created.merchantRefundNo,
          status: "EXCEPTION",
        }),
      );
    }
  }

  const failed = createdRefunds.filter(
    (refund) => refund.status === "EXCEPTION",
  ).length;
  await campaignState.updateRefundProgress({
    campaignId: CAMPAIGN_ID,
    status: createdRefunds.length === 0 ? "SETTLED" : "REFUNDING",
    refundBatchNo: batchNo,
    refundProgress: {
      total: createdRefunds.length,
      failed,
      processing: createdRefunds.length - failed,
    },
    settledAt: createdRefunds.length === 0 ? new Date() : null,
  });

  return {
    batchNo,
    createdCount: createdRefunds.length,
    skippedExisting: false,
    refunds: createdRefunds,
  };
}
