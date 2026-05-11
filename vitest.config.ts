import { existsSync, readFileSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((environment, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return environment;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        return environment;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      const unwrappedValue = rawValue.replace(/^['"]|['"]$/g, "");

      environment[key] = unwrappedValue;
      return environment;
    }, {});
}

const fileEnv = [
  ".env",
  ".env.local",
  ".env.test",
  ".env.test.local",
].reduce<Record<string, string>>(
  (environment, relativePath) => ({
    ...environment,
    ...parseEnvFile(join(rootDir, relativePath)),
  }),
  {},
);

const testSecretDirectory = join(rootDir, ".tmp", "vitest-secrets");
const merchantPrivateKeyPath = join(testSecretDirectory, "apiclient_key.pem");
const wechatPayPublicKeyPath = join(testSecretDirectory, "wechatpay_public.pem");

if (!existsSync(merchantPrivateKeyPath) || !existsSync(wechatPayPublicKeyPath)) {
  const merchantKeys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki",
    },
  });
  const wechatPayKeys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki",
    },
  });

  mkdirSync(testSecretDirectory, { recursive: true });
  writeFileSync(merchantPrivateKeyPath, merchantKeys.privateKey);
  writeFileSync(wechatPayPublicKeyPath, wechatPayKeys.publicKey);
}

const testEnv = {
  ...fileEnv,
  ...process.env,
  ADMIN_USERNAME: "test-admin",
  ADMIN_PASSWORD: "test-password-hash",
  SESSION_SECRET: "test-session-secret",
  ZPAY_MCH_ID: "test-zpay-merchant",
  ZPAY_KEY: "test-zpay-key",
  ZPAY_NOTIFY_URL: "https://example.com/api/payments/notify",
  ZPAY_RETURN_URL: "https://example.com/payment/return",
  WECHAT_PAY_APP_ID: "wx-test-app",
  WECHAT_PAY_MCH_ID: "test-wechatpay-merchant",
  WECHAT_PAY_API_V3_KEY: "12345678901234567890123456789012",
  WECHAT_PAY_MERCHANT_SERIAL_NO: "test-merchant-serial",
  WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH: merchantPrivateKeyPath,
  WECHAT_PAY_PUBLIC_KEY_ID: "test-wechatpay-public-key",
  WECHAT_PAY_PUBLIC_KEY_PATH: wechatPayPublicKeyPath,
  WECHAT_PAY_NOTIFY_URL: "https://example.com/api/payments/notify",
  WECHAT_PAY_REFUND_NOTIFY_URL: "https://example.com/api/refunds/notify",
  WECHAT_MINI_PROGRAM_APP_SECRET: "test-mini-program-app-secret",
  WECHAT_MINI_PROGRAM_URL_LINK: "https://wxaurl.cn/test-link",
  WECHAT_MINI_PROGRAM_URL_SCHEME: "weixin://dl/business/?t=test",
  NEXT_PUBLIC_WECHAT_MINI_PROGRAM_APP_ID: "wx-test-app",
  NEXT_PUBLIC_WECHAT_MINI_PROGRAM_PATH: "pages/crowdfunding/sponsor",
  TENCENT_SECRET_ID: "test-tencent-secret-id",
  TENCENT_SECRET_KEY: "test-tencent-secret-key",
  TENCENT_TMS_REGION: "ap-beijing",
  MINIO_ENDPOINT: "https://minio.example.com",
  MINIO_BUCKET: "test-expense-assets",
  MINIO_REGION: "us-east-1",
  MINIO_ACCESS_KEY_ID: "test-minio-access",
  MINIO_SECRET_ACCESS_KEY: "test-minio-secret",
  PUBLIC_ASSET_BASE_URL: "https://assets.example.com",
};

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    env: testEnv,
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
