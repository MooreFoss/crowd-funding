import "server-only";

import { createHash, createHmac } from "node:crypto";

import { serverEnv } from "@/src/config/env";
import type {
  ModerationFieldName,
  PublicTextModerationDecision,
} from "@/src/domain/pledges";
import {
  createModerationFailureSummary,
  mapTencentSuggestionToModerationStatus,
} from "@/src/domain/pledges";

type TencentTmsFetch = typeof fetch;

export type TextModerator = {
  moderateText(input: {
    text: string;
    fieldName: ModerationFieldName;
    subjectId: string;
    dataId: string;
    userKey: string;
  }): Promise<PublicTextModerationDecision>;
};

export type TencentTmsConfig = {
  secretId: string;
  secretKey: string;
  region: string;
  endpoint?: string;
  fetch?: TencentTmsFetch;
  now?: () => Date;
};

type TencentTmsResponse = {
  Response?: {
    RequestId?: string;
    Suggestion?: string;
    Label?: string;
    SubLabel?: string;
    Keywords?: string[];
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
};

const TMS_ACTION = "TextModeration";
const TMS_VERSION = "2020-12-29";
const TMS_SERVICE = "tms";
const DEFAULT_TMS_ENDPOINT = "https://tms.tencentcloudapi.com";

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(
  key: string | Buffer,
  value: string,
  encoding?: "hex",
) {
  const digest = createHmac("sha256", key).update(value);

  return encoding ? digest.digest(encoding) : digest.digest();
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createTencentCloudAuthorization(input: {
  secretId: string;
  secretKey: string;
  host: string;
  timestamp: number;
  payload: string;
}) {
  const date = formatUtcDate(new Date(input.timestamp * 1000));
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${input.host}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(input.payload),
  ].join("\n");
  const credentialScope = `${date}/${TMS_SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    input.timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const secretDate = hmacSha256(`TC3${input.secretKey}`, date);
  const secretService = hmacSha256(secretDate, TMS_SERVICE);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = hmacSha256(secretSigning, stringToSign, "hex");

  return `TC3-HMAC-SHA256 Credential=${input.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function mapTencentResponse(body: TencentTmsResponse): PublicTextModerationDecision {
  const response = body.Response;

  if (!response) {
    return {
      status: "REVIEW_ERROR",
      requestId: null,
      failureSummary: "Tencent TMS response did not include a Response object.",
      reviewedAt: new Date(),
      retryCount: 1,
    };
  }

  if (response.Error) {
    return {
      status: "REVIEW_ERROR",
      requestId: response.RequestId ?? null,
      failureSummary: createModerationFailureSummary({
        errorCode: response.Error.Code,
        errorMessage: response.Error.Message,
      }),
      reviewedAt: new Date(),
      retryCount: 1,
    };
  }

  const status = mapTencentSuggestionToModerationStatus(response.Suggestion);

  return {
    status,
    requestId: response.RequestId ?? null,
    failureSummary:
      status === "APPROVED"
        ? null
        : createModerationFailureSummary({
            suggestion: response.Suggestion,
            label: response.Label,
            subLabel: response.SubLabel,
            keywords: response.Keywords,
          }),
    reviewedAt: new Date(),
    retryCount: status === "REVIEW_ERROR" ? 1 : 0,
  };
}

function createRequestBody(input: Parameters<TextModerator["moderateText"]>[0]) {
  return {
    Content: Buffer.from(input.text, "utf8").toString("base64"),
    DataId: input.dataId,
    User: {
      UserId: input.userKey,
    },
    Device: {
      IP: input.subjectId,
    },
  };
}

export function createTencentTmsModerator(config: TencentTmsConfig): TextModerator {
  const fetchImplementation = config.fetch ?? fetch;
  const endpoint = config.endpoint ?? DEFAULT_TMS_ENDPOINT;
  const endpointUrl = new URL(endpoint);
  const host = endpointUrl.host;

  return {
    async moderateText(input) {
      const timestamp = Math.floor((config.now?.() ?? new Date()).getTime() / 1000);
      const payload = JSON.stringify(createRequestBody(input));
      const authorization = createTencentCloudAuthorization({
        secretId: config.secretId,
        secretKey: config.secretKey,
        host,
        timestamp,
        payload,
      });

      try {
        const response = await fetchImplementation(endpoint, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json; charset=utf-8",
            Host: host,
            "X-TC-Action": TMS_ACTION,
            "X-TC-Version": TMS_VERSION,
            "X-TC-Timestamp": String(timestamp),
            "X-TC-Region": config.region,
          },
          body: payload,
        });
        const body = (await response.json()) as TencentTmsResponse;

        if (!response.ok || body.Response?.Error) {
          console.error("[TMS] Request failed:", {
            status: response.status,
            requestId: body.Response?.RequestId,
            errorCode: body.Response?.Error?.Code,
            errorMessage: body.Response?.Error?.Message,
            region: config.region,
          });
        }

        if (!response.ok) {
          return {
            status: "REVIEW_ERROR",
            requestId: body.Response?.RequestId ?? null,
            failureSummary:
              body.Response?.Error?.Message ??
              `Tencent TMS request failed with HTTP ${response.status}.`,
            reviewedAt: new Date(),
            retryCount: 1,
          };
        }

        return mapTencentResponse(body);
      } catch (error) {
        console.error("[TMS] Network error:", error);
        return {
          status: "REVIEW_ERROR",
          requestId: null,
          failureSummary:
            error instanceof Error ? error.message : "Tencent TMS request failed.",
          reviewedAt: new Date(),
          retryCount: 1,
        };
      }
    },
  };
}

export function createConfiguredTencentTmsModerator() {
  return createTencentTmsModerator({
    secretId: serverEnv.tencentSecretId,
    secretKey: serverEnv.tencentSecretKey,
    region: serverEnv.tencentTmsRegion,
    endpoint: serverEnv.tencentTmsEndpoint || undefined,
  });
}
