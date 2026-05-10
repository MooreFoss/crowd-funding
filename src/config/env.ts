import "server-only";

import { z } from "zod";

const urlEnvSchema = z.string().url();

function readRequiredStringEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredUrlEnv(name: string) {
  return urlEnvSchema.parse(readRequiredStringEnv(name));
}

export const serverEnv = {
  get databaseUrl() {
    return readRequiredStringEnv("DATABASE_URL");
  },
  get adminUsername() {
    return readRequiredStringEnv("ADMIN_USERNAME");
  },
  get adminPasswordHash() {
    return readRequiredStringEnv("ADMIN_PASSWORD_HASH");
  },
  get sessionSecret() {
    return readRequiredStringEnv("SESSION_SECRET");
  },
  get zpayMerchantId() {
    return readRequiredStringEnv("ZPAY_MCH_ID");
  },
  get zpayKey() {
    return readRequiredStringEnv("ZPAY_KEY");
  },
  get zpayNotifyUrl() {
    return readRequiredUrlEnv("ZPAY_NOTIFY_URL");
  },
  get zpayReturnUrl() {
    return readRequiredUrlEnv("ZPAY_RETURN_URL");
  },
  get tencentSecretId() {
    return readRequiredStringEnv("TENCENT_SECRET_ID");
  },
  get tencentSecretKey() {
    return readRequiredStringEnv("TENCENT_SECRET_KEY");
  },
  get tencentTmsRegion() {
    return readRequiredStringEnv("TENCENT_TMS_REGION");
  },
  get tencentTmsEndpoint() {
    return process.env.TENCENT_TMS_ENDPOINT;
  },
  get minioEndpoint() {
    return readRequiredUrlEnv("MINIO_ENDPOINT");
  },
  get minioBucket() {
    return readRequiredStringEnv("MINIO_BUCKET");
  },
  get minioRegion() {
    return readRequiredStringEnv("MINIO_REGION");
  },
  get minioAccessKeyId() {
    return readRequiredStringEnv("MINIO_ACCESS_KEY_ID");
  },
  get minioSecretAccessKey() {
    return readRequiredStringEnv("MINIO_SECRET_ACCESS_KEY");
  },
  get publicAssetBaseUrl() {
    return readRequiredUrlEnv("PUBLIC_ASSET_BASE_URL");
  },
};

export type ServerEnv = typeof serverEnv;
