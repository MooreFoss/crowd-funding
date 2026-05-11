import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

import { Pool } from "pg";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((environment, line) => {
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

      environment[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return environment;
    }, {});
}

function readDatabaseUrl() {
  const env = {
    ...parseEnvFile(join(process.cwd(), ".env")),
    ...parseEnvFile(join(process.cwd(), ".env.local")),
    ...process.env,
  };
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the Playwright web server.");
  }

  return databaseUrl;
}

function readDatabaseSchema() {
  const schema = process.env.PLAYWRIGHT_DATABASE_SCHEMA ?? "cf_playwright_e2e";

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(
      `PLAYWRIGHT_DATABASE_SCHEMA must be a valid PostgreSQL identifier. Received: ${schema}`,
    );
  }

  return schema;
}

function withSchemaSearchPath(databaseUrl, schema) {
  const connection = new URL(databaseUrl);
  connection.searchParams.set("options", `-c search_path=${schema},public`);
  return connection.toString();
}

function ensurePlaywrightWechatPayKeys() {
  const secretDirectory = join(process.cwd(), ".tmp", "playwright-secrets");
  const merchantPrivateKeyPath =
    process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY_PATH ??
    join(secretDirectory, "apiclient_key.pem");
  const wechatPayPublicKeyPath =
    process.env.WECHAT_PAY_PUBLIC_KEY_PATH ??
    join(secretDirectory, "wechatpay_public.pem");

  if (existsSync(merchantPrivateKeyPath) && existsSync(wechatPayPublicKeyPath)) {
    return;
  }

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

  mkdirSync(secretDirectory, { recursive: true });
  writeFileSync(merchantPrivateKeyPath, merchantKeys.privateKey);
  writeFileSync(wechatPayPublicKeyPath, wechatPayKeys.publicKey);
}

function createPlaywrightWechatPayStubServer() {
  const orders = new Map();
  const refunds = new Map();
  const host = "127.0.0.1";
  const port = Number(process.env.PLAYWRIGHT_WECHATPAY_STUB_PORT ?? 3100);

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (
      request.method === "POST" &&
      (url.pathname === "/v3/pay/transactions/native" ||
        url.pathname === "/v3/pay/transactions/jsapi")
    ) {
      let body = "";

      request.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        const merchantOrderNo = parsed.out_trade_no;

        if (!merchantOrderNo) {
          response.writeHead(400, {
            "content-type": "application/json",
          });
          response.end(JSON.stringify({ code: 0, msg: "missing out_trade_no" }));
          return;
        }

        const tradeNo = `WX-${merchantOrderNo}`;
        orders.set(merchantOrderNo, {
          tradeNo,
          paid: true,
        });

        response.writeHead(200, {
          "content-type": "application/json",
        });
        response.end(JSON.stringify(
          url.pathname.endsWith("/jsapi")
            ? { prepay_id: `prepay-${merchantOrderNo}` }
            : { code_url: `weixin://wxpay/bizpayurl?pr=${encodeURIComponent(merchantOrderNo)}` },
        ));
      });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/v3/pay/transactions/out-trade-no/")) {
      const merchantOrderNo = decodeURIComponent(
        url.pathname.split("/").at(-1) ?? "",
      );
      const order = merchantOrderNo ? orders.get(merchantOrderNo) : null;

      response.writeHead(200, {
        "content-type": "application/json",
      });
      response.end(
        JSON.stringify({
          transaction_id: order?.tradeNo ?? `WX-${merchantOrderNo}`,
          out_trade_no: merchantOrderNo,
          trade_state: order?.paid ? "SUCCESS" : "NOTPAY",
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/v3/refund/domestic/refunds") {
      let body = "";

      request.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        const merchantRefundNo = parsed.out_refund_no;

        if (merchantRefundNo) {
          refunds.set(merchantRefundNo, {
            merchantOrderNo: parsed.out_trade_no,
            providerRefundNo: `WX-REFUND-${merchantRefundNo}`,
          });
        }

        response.writeHead(200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify({
            refund_id: merchantRefundNo
              ? `WX-REFUND-${merchantRefundNo}`
              : null,
            out_refund_no: merchantRefundNo,
            status: "PROCESSING",
          }),
        );
      });
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

function createPlaywrightTmsStubServer() {
  const host = "127.0.0.1";
  const port = Number(process.env.PLAYWRIGHT_TMS_STUB_PORT ?? 3200);

  const server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      const parsed = body ? JSON.parse(body) : {};
      const decodedContent =
        typeof parsed.Content === "string"
          ? Buffer.from(parsed.Content, "base64").toString("utf8")
          : "";
      const rejected = decodedContent.toLowerCase().includes("reject");

      response.writeHead(200, {
        "content-type": "application/json",
      });
      response.end(
        JSON.stringify({
          Response: {
            RequestId: `tms-${parsed.DataId ?? "playwright"}`,
            Suggestion: rejected ? "Block" : "Pass",
            Label: rejected ? "Illegal" : "Normal",
            Keywords: rejected ? ["reject"] : [],
          },
        }),
      );
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

async function applyMigrations() {
  const databaseUrl = readDatabaseUrl();
  const schema = readDatabaseSchema();
  const adminPool = new Pool({
    connectionString: databaseUrl,
  });
  const migrationPool = new Pool({
    connectionString: withSchemaSearchPath(databaseUrl, schema),
  });
  const migrationsDirectory = join(
    process.cwd(),
    "src",
    "infrastructure",
    "persistence",
    "migrations",
  );
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  try {
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    for (const migrationFile of migrationFiles) {
      const sql = await readFile(
        join(migrationsDirectory, migrationFile),
        "utf8",
      );
      await migrationPool.query(sql);
    }
  } finally {
    await migrationPool.end();
    await adminPool.end();
  }
}

async function main() {
  const databaseUrl = readDatabaseUrl();
  const schema = readDatabaseSchema();
  ensurePlaywrightWechatPayKeys();
  const wechatPayServer = await createPlaywrightWechatPayStubServer();
  const tmsServer = await createPlaywrightTmsStubServer();
  await applyMigrations();
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "pnpm";
  const nextPort = process.env.PLAYWRIGHT_NEXT_PORT ?? "3000";
  const nextCommand =
    process.env.PLAYWRIGHT_NEXT_MODE === "start" ? "start" : "dev";
  const args = isWindows
    ? [
        "/c",
        "pnpm",
        "exec",
        "next",
        nextCommand,
        "--hostname",
        "127.0.0.1",
        "--port",
        nextPort,
      ]
    : ["exec", "next", nextCommand, "--hostname", "127.0.0.1", "--port", nextPort];

  const child = spawn(
    command,
    args,
    {
      env: {
        ...process.env,
        DATABASE_URL: withSchemaSearchPath(databaseUrl, schema),
        PLAYWRIGHT_DATABASE_SCHEMA: schema,
        TENCENT_TMS_ENDPOINT:
          process.env.TENCENT_TMS_ENDPOINT ??
          `http://127.0.0.1:${process.env.PLAYWRIGHT_TMS_STUB_PORT ?? 3200}`,
      },
      stdio: "inherit",
    },
  );

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => {
    wechatPayServer.close();
    tmsServer.close();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
