import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

import { serverEnv } from "@/src/config/env";

export type MinioStorageConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicAssetBaseUrl: string;
  now?: () => Date;
};

export type EvidenceUploadTargetInput = {
  fileName: string;
  contentType: string;
  prefix?: string;
  expiresInSeconds?: number;
};

export type EvidenceUploadTarget = {
  objectKey: string;
  uploadUrl: string;
  assetUrl: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacSha256Hex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  const safe = normalized.replace(/[^A-Za-z0-9._-]/g, "-");

  return safe || "evidence.bin";
}

function joinUrl(baseUrl: string, objectKey: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function createObjectKey(input: {
  fileName: string;
  prefix: string;
  now: Date;
}) {
  const datePrefix = input.now.toISOString().slice(0, 10).replaceAll("-", "/");
  const normalizedPrefix = input.prefix.replace(/^\/+|\/+$/g, "");

  return `${normalizedPrefix}/${datePrefix}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function createCredentialScope(input: {
  dateStamp: string;
  region: string;
}) {
  return `${input.dateStamp}/${input.region}/s3/aws4_request`;
}

function createSigningKey(input: {
  dateStamp: string;
  region: string;
  secretAccessKey: string;
}) {
  const dateKey = hmacSha256(`AWS4${input.secretAccessKey}`, input.dateStamp);
  const regionKey = hmacSha256(dateKey, input.region);
  const serviceKey = hmacSha256(regionKey, "s3");

  return hmacSha256(serviceKey, "aws4_request");
}

function createCanonicalQueryString(parameters: Record<string, string>) {
  return Object.entries(parameters)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
}

function createCanonicalPath(input: {
  endpoint: URL;
  bucket: string;
  objectKey: string;
}) {
  const endpointSegments = input.endpoint.pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  const objectSegments = input.objectKey.split("/").filter(Boolean);

  return `/${[...endpointSegments, input.bucket, ...objectSegments]
    .map(awsEncode)
    .join("/")}`;
}

export function createMinioEvidenceStorage(config: MinioStorageConfig) {
  const endpoint = new URL(config.endpoint);

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("MinIO endpoint must use http or https.");
  }

  return {
    createUploadTarget(input: EvidenceUploadTargetInput): EvidenceUploadTarget {
      const now = config.now?.() ?? new Date();
      const expiresInSeconds = input.expiresInSeconds ?? 900;
      const endTimestamp = Math.floor(now.getTime() / 1000) + expiresInSeconds;
      const dateStamp = formatDateStamp(now);
      const amzDate = formatAmzDate(now);
      const credentialScope = createCredentialScope({
        dateStamp,
        region: config.region,
      });
      const signedHeaders = "content-type;host";
      const contentType = input.contentType.trim().toLowerCase();
      const objectKey = createObjectKey({
        fileName: input.fileName,
        prefix: input.prefix ?? "expense-evidence",
        now,
      });
      const canonicalUri = createCanonicalPath({
        endpoint,
        bucket: config.bucket,
        objectKey,
      });
      const queryParameters = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
        "X-Amz-Date": amzDate,
        "X-Amz-Expires": String(expiresInSeconds),
        "X-Amz-SignedHeaders": signedHeaders,
      };
      const canonicalQueryString = createCanonicalQueryString(queryParameters);
      const canonicalHeaders = `content-type:${contentType}\nhost:${endpoint.host}\n`;
      const canonicalRequest = [
        "PUT",
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        "UNSIGNED-PAYLOAD",
      ].join("\n");
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
      ].join("\n");
      const signature = hmacSha256Hex(
        createSigningKey({
          dateStamp,
          region: config.region,
          secretAccessKey: config.secretAccessKey,
        }),
        stringToSign,
      );
      const uploadUrl = new URL(endpoint.toString());

      uploadUrl.pathname = canonicalUri;
      uploadUrl.search = `${canonicalQueryString}&X-Amz-Signature=${signature}`;

      return {
        objectKey,
        uploadUrl: uploadUrl.toString(),
        assetUrl: joinUrl(config.publicAssetBaseUrl, objectKey),
        headers: {
          "content-type": contentType,
        },
        expiresAt: new Date(endTimestamp * 1000),
      };
    },
  };
}

export function createConfiguredMinioEvidenceStorage() {
  return createMinioEvidenceStorage({
    endpoint: serverEnv.minioEndpoint,
    bucket: serverEnv.minioBucket,
    region: serverEnv.minioRegion,
    accessKeyId: serverEnv.minioAccessKeyId,
    secretAccessKey: serverEnv.minioSecretAccessKey,
    publicAssetBaseUrl: serverEnv.publicAssetBaseUrl,
  });
}
