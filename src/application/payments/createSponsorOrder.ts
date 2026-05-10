import { randomUUID } from "node:crypto";

import type { TermsRepository } from "@/src/domain/terms";
import type {
  ModerationReviewRepository,
  PledgeRepository,
  PledgeStatus,
} from "@/src/domain/pledges";
import { moderateSponsorText } from "@/src/application/public";
import { createConfiguredTencentTmsModerator, type TextModerator } from "@/src/infrastructure/moderation";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import {
  createModerationReviewRepository,
  createPledgeRepository,
  createTermsRepository,
} from "@/src/infrastructure/persistence/repositories";
import { validateSponsorSubmission } from "@/src/validation/sponsor";

export type PaymentGateway = {
  createH5Payment(input: {
    merchantOrderNo: string;
    amountFen: number;
    clientIp: string;
    userKey: string;
    productName: string;
  }): Promise<{
    providerOrderNo: string | null;
    paymentRedirectUrl: string;
  }>;
  queryOrder(input: {
    merchantOrderNo: string;
  }): Promise<{
    providerOrderNo: string | null;
    paid: boolean;
  }>;
  verifyNotification(payload: Record<string, string>): boolean;
};

type PaymentRepositoriesInput = {
  executor?: DatabaseExecutor;
  moderationReviews?: ModerationReviewRepository;
  pledges?: PledgeRepository;
  terms?: TermsRepository;
};

export type SponsorOrderResult = {
  merchantOrderNo: string;
  amountFen: number;
  status: Extract<PledgeStatus, "PENDING" | "PAYING" | "PAID" | "CANCELLED" | "FAILED">;
  paymentRedirectUrl: string | null;
  providerOrderNo: string | null;
  termsVersionId: string;
};

type CreateSponsorOrderOptions = {
  repositories?: PaymentRepositoriesInput;
  gateway: PaymentGateway;
  moderator?: TextModerator;
  merchantOrderNoFactory?: () => string;
};

function resolvePaymentRepositories(input?: PaymentRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return {
    moderationReviews:
      input?.moderationReviews ?? createModerationReviewRepository(executor),
    pledges: input?.pledges ?? createPledgeRepository(executor),
    terms: input?.terms ?? createTermsRepository(executor),
  };
}

function createMerchantOrderNo() {
  return `CF-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createSponsorOrder(
  input: {
    amount: string;
    displayName: string;
    message: string;
    termsAccepted: boolean;
    userKey: string;
    clientIp: string;
    userAgent?: string;
  },
  options: CreateSponsorOrderOptions,
): Promise<SponsorOrderResult> {
  const submission = validateSponsorSubmission({
    ...input,
    userAgent: input.userAgent ?? "",
  });
  const { moderationReviews, pledges, terms } = resolvePaymentRepositories(
    options.repositories,
  );
  const activeTerms = await terms.findActive();

  if (!activeTerms) {
    throw new Error("No active terms version is available for sponsorship.");
  }

  const merchantOrderNo =
    options.merchantOrderNoFactory?.() ?? createMerchantOrderNo();

  const pendingOrder = await pledges.createPending({
    merchantOrderNo,
    paymentChannel: "ZPAY_WECHAT_H5",
    userKey: submission.userKey,
    submittedName: submission.displayName,
    publicName: null,
    submittedMessage: submission.message,
    publicMessage: null,
    amountFen: submission.amountFen,
    paymentRedirectUrl: null,
    termsVersionId: activeTerms.id,
    termsAcceptedAt: new Date(),
  });

  try {
    await moderateSponsorText(
      {
        pledgeId: pendingOrder.id,
        publicDisplayName: submission.publicDisplayName,
        publicMessage: submission.message,
        userKey: submission.userKey,
      },
      {
        moderator: options.moderator ?? createConfiguredTencentTmsModerator(),
        repositories: {
          moderationReviews,
          pledges,
        },
      },
    );
  } catch (error) {
    await pledges.markPaymentOutcome({
      merchantOrderNo,
      providerOrderNo: null,
      status: "FAILED",
      failedAt: new Date(),
    });
    throw error;
  }

  try {
    const payment = await options.gateway.createH5Payment({
      merchantOrderNo,
      amountFen: submission.amountFen,
      clientIp: submission.clientIp,
      userKey: submission.userKey,
      productName: "众筹赞助支持",
    });
    const payingOrder = await pledges.markPaymentOutcome({
      merchantOrderNo,
      providerOrderNo: payment.providerOrderNo,
      paymentRedirectUrl: payment.paymentRedirectUrl,
      status: "PAYING",
    });

    return {
      merchantOrderNo: payingOrder.merchantOrderNo,
      amountFen: payingOrder.amountFen,
      status: "PAYING",
      paymentRedirectUrl: payingOrder.paymentRedirectUrl,
      providerOrderNo: payingOrder.providerOrderNo,
      termsVersionId: activeTerms.id,
    };
  } catch (error) {
    await pledges.markPaymentOutcome({
      merchantOrderNo,
      providerOrderNo: null,
      status: "FAILED",
      failedAt: new Date(),
    });
    throw error;
  }
}
