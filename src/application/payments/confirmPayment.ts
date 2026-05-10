import type { AuditLogRepository } from "@/src/domain/audit";
import type { PledgeRepository } from "@/src/domain/pledges";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import { createPledgeRepository } from "@/src/infrastructure/persistence/repositories";
import { logAuditEventIdempotent } from "@/src/infrastructure/audit";
import { getStatusLabel } from "@/src/shared";

import type { PaymentGateway } from "./createSponsorOrder";

type PaymentRepositoriesInput = {
  auditLogs?: AuditLogRepository;
  executor?: DatabaseExecutor;
  pledges?: PledgeRepository;
};

export type PublicSponsorOrderStatus = {
  merchantOrderNo: string;
  status: string;
  statusLabel: string;
  paymentRedirectUrl: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
};

function resolvePaymentRepositories(input?: PaymentRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return {
    pledges: input?.pledges ?? createPledgeRepository(executor),
  };
}

function mapPublicSponsorOrderStatus(record: Awaited<ReturnType<PledgeRepository["findByMerchantOrderNo"]>>) {
  if (!record) {
    return null;
  }

  return {
    merchantOrderNo: record.merchantOrderNo,
    status: record.status,
    statusLabel: getStatusLabel(record.status),
    paymentRedirectUrl: record.paymentRedirectUrl,
    paidAt: record.paidAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    failedAt: record.failedAt?.toISOString() ?? null,
  } satisfies PublicSponsorOrderStatus;
}

export async function confirmPaymentNotification(
  input: {
    merchantOrderNo: string;
    providerOrderNo: string | null;
    paid: boolean;
  },
  repositories?: PaymentRepositoriesInput,
) {
  const { pledges } = resolvePaymentRepositories(repositories);
  const current = await pledges.findByMerchantOrderNo(input.merchantOrderNo);

  if (!current) {
    throw new Error(`Pledge ${input.merchantOrderNo} was not found.`);
  }

  if (current.status === "PAID") {
    return mapPublicSponsorOrderStatus(current);
  }

  const record = input.paid
    ? await pledges.markPaymentOutcome({
        merchantOrderNo: input.merchantOrderNo,
        providerOrderNo: input.providerOrderNo,
        status: "PAID",
        paidAt: current.paidAt ?? new Date(),
      })
    : current;

  if (input.paid && (!repositories || repositories.auditLogs)) {
    await logAuditEventIdempotent(
      {
        actorType: "SYSTEM",
        actorId: "zpay",
        action: "PAYMENT_NOTIFICATION",
        targetType: "PLEDGE",
        targetId: current.id,
        beforeSummary: { status: current.status },
        afterSummary: { status: record.status },
        metadata: {
          merchantOrderNo: input.merchantOrderNo,
          providerOrderNo: input.providerOrderNo,
        },
        idempotencyKey: `payment:${input.merchantOrderNo}:paid`,
      },
      repositories?.auditLogs
        ? { auditLogs: repositories.auditLogs }
        : undefined,
    );
  }

  return mapPublicSponsorOrderStatus(record);
}

export async function refreshSponsorOrderStatus(
  input: {
    merchantOrderNo: string;
    gateway: PaymentGateway;
  },
  repositories?: PaymentRepositoriesInput,
) {
  const { pledges } = resolvePaymentRepositories(repositories);
  const current = await pledges.findByMerchantOrderNo(input.merchantOrderNo);

  if (!current) {
    return null;
  }

  if (current.status === "PAID" || current.status === "CANCELLED" || current.status === "FAILED") {
    return mapPublicSponsorOrderStatus(current);
  }

  const queryResult = await input.gateway.queryOrder({
    merchantOrderNo: input.merchantOrderNo,
  });

  if (queryResult.paid) {
    const updated = await pledges.markPaymentOutcome({
      merchantOrderNo: input.merchantOrderNo,
      providerOrderNo: queryResult.providerOrderNo,
      status: "PAID",
      paidAt: current.paidAt ?? new Date(),
    });

    return mapPublicSponsorOrderStatus(updated);
  }

  return mapPublicSponsorOrderStatus(current);
}
