import { randomUUID } from "node:crypto";

import type { AuditLogRepository } from "@/src/domain/audit";
import type { CampaignStateRepository } from "@/src/domain/funding";
import type { ExpenseRepository } from "@/src/domain/expenses";
import type { PledgeRecord, PledgeRepository } from "@/src/domain/pledges";
import type { RefundRecord, RefundRepository, RefundStatus } from "@/src/domain/refunds";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import {
  createCampaignStateRepository,
  createExpenseRepository,
  createPledgeRepository,
  createRefundRepository,
} from "@/src/infrastructure/persistence/repositories";
import { createConfiguredPaymentGateway } from "@/src/application/payments";
import { logAuditEvent, logAuditEventIdempotent } from "@/src/infrastructure/audit";
import { parseMoneyToFen } from "@/src/shared";

export type RefundGateway = {
  createRefund(input: {
    merchantOrderNo: string;
    merchantRefundNo: string;
    amountFen: number;
    reason: string;
  }): Promise<{
    providerRefundNo: string | null;
    accepted: boolean;
  }>;
};

export type RefundRepositoriesInput = {
  auditLogs?: AuditLogRepository;
  campaignState?: CampaignStateRepository;
  executor?: DatabaseExecutor;
  expenses?: ExpenseRepository;
  pledges?: PledgeRepository;
  refunds?: RefundRepository;
};

export type AdminRefundListItem = {
  id: string;
  pledgeId: string;
  merchantOrderNo: string | null;
  merchantRefundNo: string;
  providerRefundNo: string | null;
  batchNo: string | null;
  amountFen: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
  completedAt: string | null;
};

function resolveRefundRepositories(input?: RefundRepositoriesInput) {
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

function createMerchantRefundNo() {
  return `RF-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function ensureRefundablePledge(pledge: PledgeRecord | null) {
  if (!pledge) {
    throw new Error("Pledge was not found.");
  }

  if (!["PAID", "PARTIAL_REFUNDED"].includes(pledge.status)) {
    throw new Error("Only paid pledges can be refunded.");
  }

  if (pledge.netAmountFen <= 0) {
    throw new Error("Pledge has no refundable balance.");
  }

  return pledge;
}

function mapRefundForAdmin(
  refund: RefundRecord,
  pledge: PledgeRecord | null,
): AdminRefundListItem {
  return {
    id: refund.id,
    pledgeId: refund.pledgeId,
    merchantOrderNo: pledge?.merchantOrderNo ?? null,
    merchantRefundNo: refund.merchantRefundNo,
    providerRefundNo: refund.providerRefundNo,
    batchNo: refund.batchNo,
    amountFen: refund.amountFen,
    reason: refund.reason,
    status: refund.status,
    requestedBy: refund.requestedBy,
    requestedAt: refund.requestedAt.toISOString(),
    completedAt: refund.completedAt?.toISOString() ?? null,
  };
}

export async function createSingleRefund(
  input: {
    pledgeId?: string;
    merchantOrderNo?: string;
    amount: string;
    reason: string;
    requestedBy: string;
  },
  options: {
    gateway?: RefundGateway;
    merchantRefundNoFactory?: () => string;
    repositories?: RefundRepositoriesInput;
  } = {},
) {
  const { pledges, refunds } = resolveRefundRepositories(options.repositories);
  const pledge = ensureRefundablePledge(
    input.pledgeId
      ? await pledges.findById(input.pledgeId)
      : await pledges.findByMerchantOrderNo(input.merchantOrderNo ?? ""),
  );
  const amountFen = parseMoneyToFen(input.amount);

  if (amountFen <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  if (amountFen > pledge.netAmountFen) {
    throw new Error("Refund amount exceeds the pledge refundable balance.");
  }

  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("Refund reason is required.");
  }

  const merchantRefundNo =
    options.merchantRefundNoFactory?.() ?? createMerchantRefundNo();
  const created = await refunds.create({
    pledgeId: pledge.id,
    merchantRefundNo,
    amountFen,
    reason,
    requestedBy: input.requestedBy,
    status: "CREATED",
  });

  try {
    const gateway = options.gateway ?? createConfiguredPaymentGateway();
    const response = await gateway.createRefund({
      merchantOrderNo: pledge.merchantOrderNo,
      merchantRefundNo,
      amountFen,
      reason,
    });

    return refunds.markStatus({
      merchantRefundNo,
      providerRefundNo: response.providerRefundNo,
      status: response.accepted ? "PROCESSING" : "EXCEPTION",
    }).then(async (refund) => {
      if (!options.repositories || options.repositories.auditLogs) {
        await logAuditEvent(
          {
            actorType: "ADMIN",
            actorId: input.requestedBy,
            action: "SINGLE_REFUND_REQUESTED",
            targetType: "REFUND",
            targetId: refund.id,
            afterSummary: {
              pledgeId: pledge.id,
              merchantRefundNo,
              amountFen,
              status: refund.status,
            },
          },
          options.repositories?.auditLogs
            ? { auditLogs: options.repositories.auditLogs }
            : undefined,
        );
      }

      return refund;
    });
  } catch (error) {
    await refunds.markStatus({
      merchantRefundNo: created.merchantRefundNo,
      status: "EXCEPTION",
    });
    throw error;
  }
}

export async function confirmRefundNotification(
  input: {
    merchantRefundNo: string;
    providerRefundNo: string | null;
    status: RefundStatus;
  },
  repositories?: RefundRepositoriesInput,
) {
  const { pledges, refunds } = resolveRefundRepositories(repositories);
  const current = await refunds.findByMerchantRefundNo(input.merchantRefundNo);

  if (!current) {
    throw new Error(`Refund ${input.merchantRefundNo} was not found.`);
  }

  if (current.status === "SUCCEEDED") {
    return current;
  }

  const updated = await refunds.markStatus({
    merchantRefundNo: input.merchantRefundNo,
    providerRefundNo: input.providerRefundNo,
    status: input.status,
    completedAt: input.status === "SUCCEEDED" ? new Date() : null,
  });

  if (input.status === "SUCCEEDED") {
    await pledges.applySuccessfulRefund({
      pledgeId: current.pledgeId,
      amountFen: current.amountFen,
    });
  }

  if (!repositories || repositories.auditLogs) {
    await logAuditEventIdempotent(
      {
        actorType: "SYSTEM",
        actorId: "zpay",
        action: "REFUND_NOTIFICATION",
        targetType: "REFUND",
        targetId: current.id,
        beforeSummary: { status: current.status },
        afterSummary: { status: updated.status },
        metadata: {
          merchantRefundNo: input.merchantRefundNo,
          providerRefundNo: input.providerRefundNo,
        },
        idempotencyKey: `refund:${input.merchantRefundNo}:${input.status}`,
      },
      repositories?.auditLogs ? { auditLogs: repositories.auditLogs } : undefined,
    );
  }

  return updated;
}

export async function listRefundCenter(
  repositories?: RefundRepositoriesInput,
) {
  const { campaignState, pledges, refunds } = resolveRefundRepositories(
    repositories,
  );
  const [campaign, refundRecords, pledgeRecords] = await Promise.all([
    campaignState.findCurrent(),
    refunds.listAll(),
    pledges.listAdmin({ limit: 200, offset: 0 }),
  ]);
  const pledgeById = new Map(
    pledgeRecords.map((pledge) => [pledge.id, pledge] as const),
  );

  return {
    campaign,
    refunds: refundRecords.map((refund) =>
      mapRefundForAdmin(refund, pledgeById.get(refund.pledgeId) ?? null),
    ),
    refundablePledges: pledgeRecords
      .filter((pledge) =>
        ["PAID", "PARTIAL_REFUNDED"].includes(pledge.status),
      )
      .map((pledge) => ({
        id: pledge.id,
        merchantOrderNo: pledge.merchantOrderNo,
        displayName: pledge.publicName?.trim() || "匿名用户",
        netAmountFen: pledge.netAmountFen,
        status: pledge.status,
      })),
  };
}
