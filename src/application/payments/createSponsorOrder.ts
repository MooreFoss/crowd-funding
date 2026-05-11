import { randomUUID } from "node:crypto";

import type { CampaignStateRepository } from "@/src/domain/funding";
import { isCampaignAcceptingSponsors } from "@/src/domain/funding";
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
  createCampaignStateRepository,
  createModerationReviewRepository,
  createPledgeRepository,
  createTermsRepository,
} from "@/src/infrastructure/persistence/repositories";
import { validateSponsorSubmission } from "@/src/validation/sponsor";

export type PaymentGateway = {
  createMiniProgramPayment(input: {
    merchantOrderNo: string;
    amountFen: number;
    clientIp: string;
    openid: string;
    productName: string;
  }): Promise<{
    providerOrderNo: string | null;
    prepayId: string;
    payment: {
      timeStamp: string;
      nonceStr: string;
      package: string;
      signType: "RSA";
      paySign: string;
    };
  }>;
  createNativePayment(input: {
    merchantOrderNo: string;
    amountFen: number;
    clientIp: string;
    productName: string;
  }): Promise<{
    providerOrderNo: string | null;
    codeUrl: string;
  }>;
  queryOrder(input: {
    merchantOrderNo: string;
  }): Promise<{
    providerOrderNo: string | null;
    paid: boolean;
    tradeState?: string | null;
  }>;
  createRefund(input: {
    merchantOrderNo: string;
    merchantRefundNo: string;
    amountFen: number;
    reason: string;
  }): Promise<{
    providerRefundNo: string | null;
    accepted: boolean;
  }>;
  verifyAndDecryptNotification(input: {
    body: string;
    headers: Headers;
  }): Promise<{
    eventType: string;
    resource: Record<string, unknown>;
  }>;
};

type PaymentRepositoriesInput = {
  campaignState?: CampaignStateRepository;
  executor?: DatabaseExecutor;
  moderationReviews?: ModerationReviewRepository;
  pledges?: PledgeRepository;
  terms?: TermsRepository;
};

export type SponsorPaymentMode = "MINI_PROGRAM_JSAPI" | "WEB_NATIVE";

export type SponsorOrderResult =
  | {
      mode: "MINI_PROGRAM_JSAPI";
      merchantOrderNo: string;
      amountFen: number;
      status: Extract<PledgeStatus, "PAYING">;
      providerOrderNo: string | null;
      termsVersionId: string;
      payment: {
        timeStamp: string;
        nonceStr: string;
        package: string;
        signType: "RSA";
        paySign: string;
      };
    }
  | {
      mode: "WEB_NATIVE";
      merchantOrderNo: string;
      amountFen: number;
      status: Extract<PledgeStatus, "PAYING">;
      providerOrderNo: string | null;
      termsVersionId: string;
      codeUrl: string;
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
    campaignState:
      input?.campaignState ?? createCampaignStateRepository(executor),
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
    mode: SponsorPaymentMode;
    openid?: string;
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
  const { campaignState, moderationReviews, pledges, terms } =
    resolvePaymentRepositories(options.repositories);
  const currentCampaign = await campaignState.findCurrent();

  if (!isCampaignAcceptingSponsors(currentCampaign)) {
    throw new Error("众筹已结束，当前不能创建新的赞助订单。");
  }

  const activeTerms = await terms.findActive();

  if (!activeTerms) {
    throw new Error("No active terms version is available for sponsorship.");
  }

  const merchantOrderNo =
    options.merchantOrderNoFactory?.() ?? createMerchantOrderNo();

  const pendingOrder = await pledges.createPending({
    merchantOrderNo,
    paymentChannel:
      input.mode === "MINI_PROGRAM_JSAPI"
        ? "WECHATPAY_MINI_PROGRAM"
        : "WECHATPAY_NATIVE",
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
    if (input.mode === "MINI_PROGRAM_JSAPI") {
      if (!input.openid) {
        throw new Error("Mini program openid is required.");
      }

      const payment = await options.gateway.createMiniProgramPayment({
        merchantOrderNo,
        amountFen: submission.amountFen,
        clientIp: submission.clientIp,
        openid: input.openid,
        productName: "众筹赞助支持",
      });
      const payingOrder = await pledges.markPaymentOutcome({
        merchantOrderNo,
        providerOrderNo: payment.providerOrderNo,
        paymentRedirectUrl: payment.payment.package,
        status: "PAYING",
      });

      return {
        mode: "MINI_PROGRAM_JSAPI",
        merchantOrderNo: payingOrder.merchantOrderNo,
        amountFen: payingOrder.amountFen,
        status: "PAYING",
        providerOrderNo: payingOrder.providerOrderNo,
        termsVersionId: activeTerms.id,
        payment: payment.payment,
      };
    }

    const payment = await options.gateway.createNativePayment({
      merchantOrderNo,
      amountFen: submission.amountFen,
      clientIp: submission.clientIp,
      productName: "众筹赞助支持",
    });
    const payingOrder = await pledges.markPaymentOutcome({
      merchantOrderNo,
      providerOrderNo: payment.providerOrderNo,
      paymentRedirectUrl: payment.codeUrl,
      status: "PAYING",
    });

    return {
      mode: "WEB_NATIVE",
      merchantOrderNo: payingOrder.merchantOrderNo,
      amountFen: payingOrder.amountFen,
      status: "PAYING",
      providerOrderNo: payingOrder.providerOrderNo,
      termsVersionId: activeTerms.id,
      codeUrl: payment.codeUrl,
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
