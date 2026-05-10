import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

const testEnv = {
  ADMIN_USERNAME: "test-admin",
  ADMIN_PASSWORD_HASH: "test-password-hash",
  SESSION_SECRET: "test-session-secret",
  ZPAY_MCH_ID: "test-zpay-merchant",
  ZPAY_KEY: "test-zpay-key",
  ZPAY_NOTIFY_URL: "https://example.com/api/payments/notify",
  ZPAY_RETURN_URL: "https://example.com/payment/return",
  TENCENT_SECRET_ID: "test-tencent-secret-id",
  TENCENT_SECRET_KEY: "test-tencent-secret-key",
  TENCENT_TMS_REGION: "ap-beijing",
  MINIO_ENDPOINT: "https://minio.example.com",
  MINIO_BUCKET: "test-expense-assets",
  MINIO_REGION: "us-east-1",
  MINIO_ACCESS_KEY_ID: "test-minio-access",
  MINIO_SECRET_ACCESS_KEY: "test-minio-secret",
  PUBLIC_ASSET_BASE_URL: "https://assets.example.com",
  ...fileEnv,
  ...process.env,
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
