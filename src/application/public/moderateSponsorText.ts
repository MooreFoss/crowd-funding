import type {
  ModerationFieldName,
  ModerationReviewRepository,
  ModerationStatus,
  ModerationSubjectType,
  PledgeRepository,
  PublicTextModerationDecision,
} from "@/src/domain/pledges";
import {
  ensureModerationAllowsPublication,
  shouldModeratePublicText,
} from "@/src/domain/pledges";
import { createConfiguredTencentTmsModerator, type TextModerator } from "@/src/infrastructure/moderation";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import {
  createModerationReviewRepository,
  createPledgeRepository,
} from "@/src/infrastructure/persistence/repositories";

type ModerationRepositoriesInput = {
  executor?: DatabaseExecutor;
  moderationReviews?: ModerationReviewRepository;
  pledges?: PledgeRepository;
};

export type ReviewPublicPledgeTextInput = {
  pledgeId: string;
  subjectType: ModerationSubjectType;
  publicDisplayName: string | null;
  publicMessage: string | null;
  userKey: string;
};

export type ReviewPublicPledgeTextOptions = {
  repositories?: ModerationRepositoriesInput;
  moderator?: TextModerator;
};

function resolveModerationRepositories(input?: ModerationRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return {
    moderationReviews:
      input?.moderationReviews ?? createModerationReviewRepository(executor),
    pledges: input?.pledges ?? createPledgeRepository(executor),
  };
}

function resolveModerator(input?: TextModerator) {
  return input ?? createConfiguredTencentTmsModerator();
}

function normalizeDecision(
  decision: PublicTextModerationDecision,
): PublicTextModerationDecision & {
  status: Exclude<ModerationStatus, "PENDING_REVIEW">;
} {
  if (decision.status === "PENDING_REVIEW") {
    return {
      ...decision,
      status: "REVIEW_ERROR",
      failureSummary: "Tencent TMS did not return a final decision.",
      retryCount: (decision.retryCount ?? 0) + 1,
    };
  }

  return {
    ...decision,
    status: decision.status,
  };
}

async function reviewField(input: {
  subjectType: ModerationSubjectType;
  subjectId: string;
  fieldName: ModerationFieldName;
  text: string | null;
  userKey: string;
  moderationReviews: ModerationReviewRepository;
  moderator: TextModerator;
}) {
  if (!shouldModeratePublicText(input.text)) {
    return null;
  }

  const submittedText = input.text.trim();
  const review = await input.moderationReviews.create({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    fieldName: input.fieldName,
    submittedText,
    status: "PENDING_REVIEW",
  });
  const decision = normalizeDecision(
    await input.moderator.moderateText({
      text: submittedText,
      fieldName: input.fieldName,
      subjectId: input.subjectId,
      dataId: review.id,
      userKey: input.userKey,
    }),
  );
  const updatedReview = await input.moderationReviews.updateResult({
    id: review.id,
    status: decision.status,
    requestId: decision.requestId,
    failureSummary: decision.failureSummary,
    reviewedAt: decision.reviewedAt ?? new Date(),
    retryCount: decision.retryCount ?? 0,
  });

  ensureModerationAllowsPublication(input.fieldName, updatedReview);
  return updatedReview;
}

export async function reviewPledgePublicText(
  input: ReviewPublicPledgeTextInput,
  options?: ReviewPublicPledgeTextOptions,
) {
  const { moderationReviews, pledges } = resolveModerationRepositories(
    options?.repositories,
  );
  const moderator = resolveModerator(options?.moderator);

  await reviewField({
    subjectType: input.subjectType,
    subjectId: input.pledgeId,
    fieldName: "DISPLAY_NAME",
    text: input.publicDisplayName,
    userKey: input.userKey,
    moderationReviews,
    moderator,
  });
  await reviewField({
    subjectType: input.subjectType,
    subjectId: input.pledgeId,
    fieldName: "MESSAGE",
    text: input.publicMessage,
    userKey: input.userKey,
    moderationReviews,
    moderator,
  });

  return pledges.updatePublicText({
    pledgeId: input.pledgeId,
    publicName: input.publicDisplayName,
    publicMessage: input.publicMessage,
  });
}

export async function moderateSponsorText(
  input: Omit<ReviewPublicPledgeTextInput, "subjectType">,
  options?: ReviewPublicPledgeTextOptions,
) {
  return reviewPledgePublicText(
    {
      ...input,
      subjectType: "PLEDGE",
    },
    options,
  );
}
