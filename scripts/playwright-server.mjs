import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
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
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
