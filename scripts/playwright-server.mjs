import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

function createPlaywrightZpayStubServer() {
  const orders = new Map();
  const host = "127.0.0.1";
  const port = 3100;

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (request.method === "POST" && url.pathname === "/mapi.php") {
      let body = "";

      request.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        const formData = new URLSearchParams(body);
        const merchantOrderNo = formData.get("out_trade_no");
        const returnUrl = formData.get("return_url");

        if (!merchantOrderNo || !returnUrl) {
          response.writeHead(400, {
            "content-type": "application/json",
          });
          response.end(JSON.stringify({ code: 0, msg: "missing out_trade_no" }));
          return;
        }

        const tradeNo = `ZPAY-${merchantOrderNo}`;
        orders.set(merchantOrderNo, {
          tradeNo,
          paid: false,
        });

        response.writeHead(200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify({
            code: 1,
            msg: "success",
            trade_no: tradeNo,
            payurl2: `http://${host}:${port}/cashier?out_trade_no=${encodeURIComponent(merchantOrderNo)}&return_url=${encodeURIComponent(returnUrl)}`,
          }),
        );
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api.php") {
      const merchantOrderNo = url.searchParams.get("out_trade_no");
      const order = merchantOrderNo ? orders.get(merchantOrderNo) : null;

      response.writeHead(200, {
        "content-type": "application/json",
      });
      response.end(
        JSON.stringify({
          code: 1,
          msg: "success",
          trade_no: order?.tradeNo ?? null,
          out_trade_no: merchantOrderNo,
          status: order?.paid ? 1 : 0,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/cashier") {
      const merchantOrderNo = url.searchParams.get("out_trade_no");
      const returnUrl = url.searchParams.get("return_url");

      if (merchantOrderNo && orders.has(merchantOrderNo)) {
        const order = orders.get(merchantOrderNo);
        order.paid = true;
        orders.set(merchantOrderNo, order);
      }

      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
      });
      response.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>ZPAY Stub</title>
  </head>
  <body>
    <p>模拟微信 H5 收银台，正在返回应用...</p>
    <script>
      setTimeout(function () {
        window.location.href = ${JSON.stringify(returnUrl ?? "http://127.0.0.1:3000/payment/return")};
      }, 500);
    </script>
  </body>
</html>`);
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
  const zpayServer = await createPlaywrightZpayStubServer();
  await applyMigrations();
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "pnpm";
  const args = isWindows
    ? ["/c", "pnpm", "exec", "next", "dev", "--hostname", "127.0.0.1", "--port", "3000"]
    : ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", "3000"];

  const child = spawn(
    command,
    args,
    {
      env: {
        ...process.env,
        DATABASE_URL: withSchemaSearchPath(databaseUrl, schema),
        PLAYWRIGHT_DATABASE_SCHEMA: schema,
      },
      stdio: "inherit",
    },
  );

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", (code) => {
    zpayServer.close();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
