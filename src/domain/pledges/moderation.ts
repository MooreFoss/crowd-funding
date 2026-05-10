import type { ModerationFieldName, ModerationStatus } from "./model";

export type PublicTextModerationDecision = {
  status: ModerationStatus;
  requestId: string | null;
  failureSummary: string | null;
  reviewedAt?: Date | null;
  retryCount?: number;
};

export class PublicTextModerationError extends Error {
  readonly fieldName: ModerationFieldName;
  readonly status: Extract<ModerationStatus, "REJECTED" | "REVIEW_ERROR">;
  readonly failureSummary: string | null;

  constructor(input: {
    fieldName: ModerationFieldName;
    status: Extract<ModerationStatus, "REJECTED" | "REVIEW_ERROR">;
    failureSummary: string | null;
  }) {
    super(
      input.status === "REJECTED"
        ? `${getModerationFieldLabel(input.fieldName)}未通过内容审核，请修改后重试，或使用匿名/空留言。`
        : `${getModerationFieldLabel(input.fieldName)}暂时无法完成内容审核，请稍后重试。`,
    );
    this.name = "PublicTextModerationError";
    this.fieldName = input.fieldName;
    this.status = input.status;
    this.failureSummary = input.failureSummary;
  }
}

export function getModerationFieldLabel(fieldName: ModerationFieldName) {
  return fieldName === "DISPLAY_NAME" ? "展示昵称" : "留言";
}

export function shouldModeratePublicText(
  text: string | null | undefined,
): text is string {
  return typeof text === "string" && text.trim().length > 0;
}

export function mapTencentSuggestionToModerationStatus(
  suggestion: string | null | undefined,
): ModerationStatus {
  switch (suggestion?.toLowerCase()) {
    case "pass":
      return "APPROVED";
    case "block":
    case "review":
      return "REJECTED";
    default:
      return "REVIEW_ERROR";
  }
}

export function createModerationFailureSummary(input: {
  suggestion?: string | null;
  label?: string | null;
  subLabel?: string | null;
  keywords?: string[] | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  if (input.errorCode || input.errorMessage) {
    return [input.errorCode, input.errorMessage].filter(Boolean).join(": ");
  }

  const parts = [
    input.suggestion ? `Suggestion=${input.suggestion}` : null,
    input.label ? `Label=${input.label}` : null,
    input.subLabel ? `SubLabel=${input.subLabel}` : null,
    input.keywords?.length
      ? `Keywords=${input.keywords.slice(0, 3).join(", ")}`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : null;
}

export function ensureModerationAllowsPublication(
  fieldName: ModerationFieldName,
  decision: PublicTextModerationDecision,
) {
  if (decision.status === "APPROVED") {
    return;
  }

  if (decision.status === "REJECTED" || decision.status === "REVIEW_ERROR") {
    throw new PublicTextModerationError({
      fieldName,
      status: decision.status,
      failureSummary: decision.failureSummary,
    });
  }

  throw new PublicTextModerationError({
    fieldName,
    status: "REVIEW_ERROR",
    failureSummary: "Moderation did not return a final decision.",
  });
}
