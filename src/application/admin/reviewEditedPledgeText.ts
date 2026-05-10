import type { AuditLogRepository } from "@/src/domain/audit";
import type {
  ModerationReviewRecord,
  ModerationReviewRepository,
  PledgeRecord,
  PledgeRepository,
} from "@/src/domain/pledges";
import { reviewPledgePublicText } from "@/src/application/public";
import { logAuditEvent } from "@/src/infrastructure/audit";
import type { TextModerator } from "@/src/infrastructure/moderation";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import {
  createModerationReviewRepository,
  createPledgeRepository,
} from "@/src/infrastructure/persistence/repositories";

type AdminPledgeRepositoriesInput = {
  auditLogs?: AuditLogRepository;
  executor?: DatabaseExecutor;
  moderationReviews?: ModerationReviewRepository;
  pledges?: PledgeRepository;
};

export type AdminPledgeReviewSummary = {
  status: string;
  statusLabel: string;
  requestId: string | null;
  failureSummary: string | null;
  reviewedAt: string | null;
  retryCount: number;
};

export type AdminPledgeListItem = {
  id: string;
  merchantOrderNo: string;
  displayName: string;
  message: string;
  amountFen: number;
  netAmountFen: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  moderation: {
    displayName: AdminPledgeReviewSummary | null;
    message: AdminPledgeReviewSummary | null;
  };
};

function resolveAdminPledgeRepositories(input?: AdminPledgeRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return {
    moderationReviews:
      input?.moderationReviews ?? createModerationReviewRepository(executor),
    pledges: input?.pledges ?? createPledgeRepository(executor),
  };
}

function normalizeEditedName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEditedMessage(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function chooseLatestReview(
  first: ModerationReviewRecord | null,
  second: ModerationReviewRecord | null,
) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first.createdAt >= second.createdAt ? first : second;
}

function getReviewStatusLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "审核通过";
    case "REJECTED":
      return "审核拒绝";
    case "REVIEW_ERROR":
      return "审核异常";
    default:
      return "待审核";
  }
}

function mapReview(
  review: ModerationReviewRecord | null,
): AdminPledgeReviewSummary | null {
  if (!review) {
    return null;
  }

  return {
    status: review.status,
    statusLabel: getReviewStatusLabel(review.status),
    requestId: review.requestId,
    failureSummary: review.failureSummary,
    reviewedAt: review.reviewedAt?.toISOString() ?? null,
    retryCount: review.retryCount,
  };
}

async function latestFieldReview(input: {
  pledgeId: string;
  fieldName: "DISPLAY_NAME" | "MESSAGE";
  moderationReviews: ModerationReviewRepository;
}) {
  const [originalReview, editReview] = await Promise.all([
    input.moderationReviews.findLatestForField(
      "PLEDGE",
      input.pledgeId,
      input.fieldName,
    ),
    input.moderationReviews.findLatestForField(
      "PLEDGE_EDIT",
      input.pledgeId,
      input.fieldName,
    ),
  ]);

  return chooseLatestReview(originalReview, editReview);
}

function mapAdminPledgeItem(input: {
  pledge: PledgeRecord;
  displayNameReview: ModerationReviewRecord | null;
  messageReview: ModerationReviewRecord | null;
}): AdminPledgeListItem {
  return {
    id: input.pledge.id,
    merchantOrderNo: input.pledge.merchantOrderNo,
    displayName: input.pledge.publicName?.trim() || "匿名用户",
    message: input.pledge.publicMessage?.trim() || "",
    amountFen: input.pledge.amountFen,
    netAmountFen: input.pledge.netAmountFen,
    status: input.pledge.status,
    createdAt: input.pledge.createdAt.toISOString(),
    paidAt: input.pledge.paidAt?.toISOString() ?? null,
    moderation: {
      displayName: mapReview(input.displayNameReview),
      message: mapReview(input.messageReview),
    },
  };
}

export async function listAdminPledges(
  request: {
    limit?: number;
    offset?: number;
  } = {},
  repositories?: AdminPledgeRepositoriesInput,
) {
  const { moderationReviews, pledges } =
    resolveAdminPledgeRepositories(repositories);
  const records = await pledges.listAdmin({
    limit: request.limit ?? 50,
    offset: request.offset ?? 0,
  });
  const items = await Promise.all(
    records.map(async (pledge) =>
      mapAdminPledgeItem({
        pledge,
        displayNameReview: await latestFieldReview({
          pledgeId: pledge.id,
          fieldName: "DISPLAY_NAME",
          moderationReviews,
        }),
        messageReview: await latestFieldReview({
          pledgeId: pledge.id,
          fieldName: "MESSAGE",
          moderationReviews,
        }),
      }),
    ),
  );

  return {
    items,
    page: {
      limit: request.limit ?? 50,
      offset: request.offset ?? 0,
      hasMore: items.length === (request.limit ?? 50),
    },
  };
}

export async function reviewEditedPledgeText(
  input: {
    pledgeId: string;
    displayName: string | null;
    message: string | null;
  },
  options?: {
    repositories?: AdminPledgeRepositoriesInput;
    moderator?: TextModerator;
  },
) {
  const { moderationReviews, pledges } = resolveAdminPledgeRepositories(
    options?.repositories,
  );
  const pledge = await pledges.findById(input.pledgeId);

  if (!pledge) {
    throw new Error(`Pledge ${input.pledgeId} was not found.`);
  }

  const updated = await reviewPledgePublicText(
    {
      pledgeId: pledge.id,
      subjectType: "PLEDGE_EDIT",
      publicDisplayName: normalizeEditedName(input.displayName),
      publicMessage: normalizeEditedMessage(input.message),
      userKey: pledge.userKey,
    },
    {
      moderator: options?.moderator,
      repositories: {
        moderationReviews,
        pledges,
      },
    },
  );

  if (!options?.repositories || options.repositories.auditLogs) {
    await logAuditEvent(
      {
        actorType: "ADMIN",
        actorId: "admin",
        action: "PLEDGE_TEXT_EDITED",
        targetType: "PLEDGE",
        targetId: pledge.id,
        beforeSummary: {
          publicName: pledge.publicName,
          publicMessage: pledge.publicMessage,
        },
        afterSummary: {
          publicName: updated.publicName,
          publicMessage: updated.publicMessage,
        },
      },
      options?.repositories?.auditLogs
        ? { auditLogs: options.repositories.auditLogs }
        : undefined,
    );
  }

  return updated;
}
