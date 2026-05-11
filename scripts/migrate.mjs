import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import { runDatabaseMigrations } from "../src/infrastructure/persistence/migrator.mjs";

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

function loadEnvironment(rootDirectory) {
  const nodeEnv = process.env.NODE_ENV;
  const envFiles = [".env"];

  if (nodeEnv) {
    envFiles.push(`.env.${nodeEnv}`);
  }

  envFiles.push(".env.local");

  if (nodeEnv) {
    envFiles.push(`.env.${nodeEnv}.local`);
  }

  return {
    ...envFiles.reduce(
      (environment, fileName) => ({
        ...environment,
        ...parseEnvFile(join(rootDirectory, fileName)),
      }),
      {},
    ),
    ...process.env,
  };
}

async function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const rootDirectory = resolve(scriptDirectory, "..");
  const env = loadEnvironment(rootDirectory);
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const client = await pool.connect();

  try {
    const result = await runDatabaseMigrations({
      client,
      migrationsDirectory: join(
        rootDirectory,
        "src",
        "infrastructure",
        "persistence",
        "migrations",
      ),
    });

    console.info(
      `Database migrations complete. Applied: ${result.applied.length}; skipped: ${result.skipped.length}.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
