import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_USERNAME: z.string().min(1, "ADMIN_USERNAME is required"),
  ADMIN_PASSWORD_HASH: z.string().min(1, "ADMIN_PASSWORD_HASH is required"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
  ZPAY_MCH_ID: z.string().min(1, "ZPAY_MCH_ID is required"),
  ZPAY_KEY: z.string().min(1, "ZPAY_KEY is required"),
  ZPAY_NOTIFY_URL: z.url("ZPAY_NOTIFY_URL must be a valid URL"),
  ZPAY_RETURN_URL: z.url("ZPAY_RETURN_URL must be a valid URL"),
  TENCENT_SECRET_ID: z.string().min(1, "TENCENT_SECRET_ID is required"),
  TENCENT_SECRET_KEY: z.string().min(1, "TENCENT_SECRET_KEY is required"),
  TENCENT_TMS_REGION: z.string().min(1, "TENCENT_TMS_REGION is required"),
  COS_BUCKET: z.string().min(1, "COS_BUCKET is required"),
  COS_REGION: z.string().min(1, "COS_REGION is required"),
  COS_SECRET_ID: z.string().min(1, "COS_SECRET_ID is required"),
  COS_SECRET_KEY: z.string().min(1, "COS_SECRET_KEY is required"),
  PUBLIC_ASSET_BASE_URL: z.url("PUBLIC_ASSET_BASE_URL must be a valid URL"),
});

const parsedServerEnv = serverEnvSchema.parse(process.env);

export const serverEnv = {
  databaseUrl: parsedServerEnv.DATABASE_URL,
  adminUsername: parsedServerEnv.ADMIN_USERNAME,
  adminPasswordHash: parsedServerEnv.ADMIN_PASSWORD_HASH,
  sessionSecret: parsedServerEnv.SESSION_SECRET,
  zpayMerchantId: parsedServerEnv.ZPAY_MCH_ID,
  zpayKey: parsedServerEnv.ZPAY_KEY,
  zpayNotifyUrl: parsedServerEnv.ZPAY_NOTIFY_URL,
  zpayReturnUrl: parsedServerEnv.ZPAY_RETURN_URL,
  tencentSecretId: parsedServerEnv.TENCENT_SECRET_ID,
  tencentSecretKey: parsedServerEnv.TENCENT_SECRET_KEY,
  tencentTmsRegion: parsedServerEnv.TENCENT_TMS_REGION,
  cosBucket: parsedServerEnv.COS_BUCKET,
  cosRegion: parsedServerEnv.COS_REGION,
  cosSecretId: parsedServerEnv.COS_SECRET_ID,
  cosSecretKey: parsedServerEnv.COS_SECRET_KEY,
  publicAssetBaseUrl: parsedServerEnv.PUBLIC_ASSET_BASE_URL,
};

export type ServerEnv = typeof serverEnv;
