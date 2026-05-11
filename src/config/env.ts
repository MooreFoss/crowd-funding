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
  get adminPassword() {
    return readRequiredStringEnv("ADMIN_PASSWORD");
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
  get wechatPayAppId() {
    return readRequiredStringEnv("WECHAT_PAY_APP_ID");
  },
  get wechatPayMchId() {
    return readRequiredStringEnv("WECHAT_PAY_MCH_ID");
  },
  get wechatPayApiV3Key() {
    return readRequiredStringEnv("WECHAT_PAY_API_V3_KEY");
  },
  get wechatPayMerchantSerialNo() {
    return readRequiredStringEnv("WECHAT_PAY_MERCHANT_SERIAL_NO");
  },
  get wechatPayMerchantPrivateKeyPath() {
    return readRequiredStringEnv("WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH");
  },
  get wechatPayPublicKeyId() {
    return readRequiredStringEnv("WECHAT_PAY_PUBLIC_KEY_ID");
  },
  get wechatPayPublicKeyPath() {
    return readRequiredStringEnv("WECHAT_PAY_PUBLIC_KEY_PATH");
  },
  get wechatPayNotifyUrl() {
    return readRequiredUrlEnv("WECHAT_PAY_NOTIFY_URL");
  },
  get wechatPayRefundNotifyUrl() {
    return readRequiredUrlEnv("WECHAT_PAY_REFUND_NOTIFY_URL");
  },
  get wechatMiniProgramAppSecret() {
    return readRequiredStringEnv("WECHAT_MINI_PROGRAM_APP_SECRET");
  },
  get wechatMiniProgramUrlLink() {
    return process.env.WECHAT_MINI_PROGRAM_URL_LINK ?? "";
  },
  get wechatMiniProgramUrlScheme() {
    return process.env.WECHAT_MINI_PROGRAM_URL_SCHEME ?? "";
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
