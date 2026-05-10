import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

import { serverEnv } from "@/src/config/env";

export type CosStorageConfig = {
  bucket: string;
  region: string;
  secretId: string;
  secretKey: string;
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

function sha1Hex(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function hmacSha1Hex(key: string, value: string) {
  return createHmac("sha1", key).update(value).digest("hex");
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

  return `${input.prefix.replace(/^\/+|\/+$/g, "")}/${datePrefix}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
}

export function createCosEvidenceStorage(config: CosStorageConfig) {
  return {
    createUploadTarget(input: EvidenceUploadTargetInput): EvidenceUploadTarget {
      const now = config.now?.() ?? new Date();
      const expiresInSeconds = input.expiresInSeconds ?? 900;
      const startTimestamp = Math.floor(now.getTime() / 1000);
      const endTimestamp = startTimestamp + expiresInSeconds;
      const keyTime = `${startTimestamp};${endTimestamp}`;
      const host = `${config.bucket}.cos.${config.region}.myqcloud.com`;
      const objectKey = createObjectKey({
        fileName: input.fileName,
        prefix: input.prefix ?? "expense-evidence",
        now,
      });
      const path = `/${objectKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      const httpMethod = "put";
      const headerList = "content-type;host";
      const httpHeaders = `content-type=${encodeURIComponent(input.contentType.toLowerCase())}&host=${encodeURIComponent(host)}`;
      const httpString = `${httpMethod}\n${path}\n\n${httpHeaders}\n`;
      const signKey = hmacSha1Hex(config.secretKey, keyTime);
      const stringToSign = `sha1\n${keyTime}\n${sha1Hex(httpString)}\n`;
      const signature = hmacSha1Hex(signKey, stringToSign);
      const uploadUrl = new URL(`https://${host}${path}`);

      uploadUrl.searchParams.set("q-sign-algorithm", "sha1");
      uploadUrl.searchParams.set("q-ak", config.secretId);
      uploadUrl.searchParams.set("q-sign-time", keyTime);
      uploadUrl.searchParams.set("q-key-time", keyTime);
      uploadUrl.searchParams.set("q-header-list", headerList);
      uploadUrl.searchParams.set("q-url-param-list", "");
      uploadUrl.searchParams.set("q-signature", signature);

      return {
        objectKey,
        uploadUrl: uploadUrl.toString(),
        assetUrl: joinUrl(config.publicAssetBaseUrl, objectKey),
        headers: {
          "content-type": input.contentType,
        },
        expiresAt: new Date(endTimestamp * 1000),
      };
    },
  };
}

export function createConfiguredCosEvidenceStorage() {
  return createCosEvidenceStorage({
    bucket: serverEnv.cosBucket,
    region: serverEnv.cosRegion,
    secretId: serverEnv.cosSecretId,
    secretKey: serverEnv.cosSecretKey,
    publicAssetBaseUrl: serverEnv.publicAssetBaseUrl,
  });
}
