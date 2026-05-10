import { describe, expect, it, vi } from "vitest";

import { createTencentTmsModerator } from "@/src/infrastructure/moderation/tencentTms";

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("Tencent Cloud TMS adapter", () => {
  it("signs TextModeration requests and maps approved responses", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        Response: {
          RequestId: "req-approved",
          Suggestion: "Pass",
          Label: "Normal",
        },
      }),
    );
    const moderator = createTencentTmsModerator({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      region: "ap-beijing",
      endpoint: "https://tms.tencentcloudapi.com",
      now: () => new Date("2026-05-10T00:00:00.000Z"),
      fetch: fetchMock,
    });

    const decision = await moderator.moderateText({
      text: "clean message",
      fieldName: "MESSAGE",
      subjectId: "pledge-1",
      dataId: "review-1",
      userKey: "user-1",
    });

    expect(decision).toMatchObject({
      status: "APPROVED",
      requestId: "req-approved",
      failureSummary: null,
      retryCount: 0,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init.headers);
    const body = JSON.parse(init.body as string);

    expect(url).toBe("https://tms.tencentcloudapi.com");
    expect(init.method).toBe("POST");
    expect(headers.get("x-tc-action")).toBe("TextModeration");
    expect(headers.get("x-tc-region")).toBe("ap-beijing");
    expect(headers.get("authorization")).toContain("TC3-HMAC-SHA256");
    expect(headers.get("authorization")).toContain(
      "Credential=test-secret-id/2026-05-10/tms/tc3_request",
    );
    expect(body.Content).toBe(Buffer.from("clean message", "utf8").toString("base64"));
    expect(body.DataId).toBe("review-1");
    expect(body.User.UserId).toBe("user-1");
  });

  it("maps rejected Tencent suggestions without exposing raw response bodies", async () => {
    const moderator = createTencentTmsModerator({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      region: "ap-beijing",
      fetch: async () =>
        createJsonResponse({
          Response: {
            RequestId: "req-rejected",
            Suggestion: "Block",
            Label: "Illegal",
            SubLabel: "Abuse",
            Keywords: ["blocked"],
          },
        }),
    });

    const decision = await moderator.moderateText({
      text: "bad text",
      fieldName: "DISPLAY_NAME",
      subjectId: "pledge-2",
      dataId: "review-2",
      userKey: "user-2",
    });

    expect(decision).toMatchObject({
      status: "REJECTED",
      requestId: "req-rejected",
      failureSummary: "Suggestion=Block; Label=Illegal; SubLabel=Abuse; Keywords=blocked",
      retryCount: 0,
    });
  });

  it("maps Tencent errors and network failures to retryable review errors", async () => {
    const apiErrorModerator = createTencentTmsModerator({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      region: "ap-beijing",
      fetch: async () =>
        createJsonResponse({
          Response: {
            RequestId: "req-error",
            Error: {
              Code: "InternalError",
              Message: "service unavailable",
            },
          },
        }),
    });
    const timeoutModerator = createTencentTmsModerator({
      secretId: "test-secret-id",
      secretKey: "test-secret-key",
      region: "ap-beijing",
      fetch: async () => {
        throw new Error("request timed out");
      },
    });

    await expect(
      apiErrorModerator.moderateText({
        text: "hello",
        fieldName: "MESSAGE",
        subjectId: "pledge-3",
        dataId: "review-3",
        userKey: "user-3",
      }),
    ).resolves.toMatchObject({
      status: "REVIEW_ERROR",
      requestId: "req-error",
      failureSummary: "InternalError: service unavailable",
      retryCount: 1,
    });

    await expect(
      timeoutModerator.moderateText({
        text: "hello",
        fieldName: "MESSAGE",
        subjectId: "pledge-4",
        dataId: "review-4",
        userKey: "user-4",
      }),
    ).resolves.toMatchObject({
      status: "REVIEW_ERROR",
      requestId: null,
      failureSummary: "request timed out",
      retryCount: 1,
    });
  });
});
