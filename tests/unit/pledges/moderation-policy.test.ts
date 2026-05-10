import { describe, expect, it } from "vitest";

import {
  PublicTextModerationError,
  createModerationFailureSummary,
  ensureModerationAllowsPublication,
  mapTencentSuggestionToModerationStatus,
  shouldModeratePublicText,
} from "@/src/domain/pledges/moderation";

describe("pledge public-text moderation policy", () => {
  it("only sends non-empty user-provided text to moderation", () => {
    expect(shouldModeratePublicText(null)).toBe(false);
    expect(shouldModeratePublicText("")).toBe(false);
    expect(shouldModeratePublicText("   ")).toBe(false);
    expect(shouldModeratePublicText("Alice")).toBe(true);
  });

  it("maps Tencent TMS suggestions into internal review states", () => {
    expect(mapTencentSuggestionToModerationStatus("Pass")).toBe("APPROVED");
    expect(mapTencentSuggestionToModerationStatus("Block")).toBe("REJECTED");
    expect(mapTencentSuggestionToModerationStatus("Review")).toBe("REJECTED");
    expect(mapTencentSuggestionToModerationStatus("unknown")).toBe("REVIEW_ERROR");
    expect(mapTencentSuggestionToModerationStatus(null)).toBe("REVIEW_ERROR");
  });

  it("blocks rejected or errored text from publication", () => {
    expect(() =>
      ensureModerationAllowsPublication("DISPLAY_NAME", {
        status: "APPROVED",
        requestId: "req-approved",
        failureSummary: null,
      }),
    ).not.toThrow();

    expect(() =>
      ensureModerationAllowsPublication("MESSAGE", {
        status: "REJECTED",
        requestId: "req-rejected",
        failureSummary: "Contains blocked content",
      }),
    ).toThrow(PublicTextModerationError);

    expect(() =>
      ensureModerationAllowsPublication("MESSAGE", {
        status: "REVIEW_ERROR",
        requestId: null,
        failureSummary: "Tencent TMS request timed out",
      }),
    ).toThrow(PublicTextModerationError);
  });

  it("builds concise non-public failure summaries", () => {
    expect(
      createModerationFailureSummary({
        suggestion: "Block",
        label: "Illegal",
        subLabel: "Abuse",
        keywords: ["first", "second", "third", "fourth"],
      }),
    ).toBe("Suggestion=Block; Label=Illegal; SubLabel=Abuse; Keywords=first, second, third");

    expect(
      createModerationFailureSummary({
        errorCode: "InternalError",
        errorMessage: "service unavailable",
      }),
    ).toBe("InternalError: service unavailable");
  });
});
