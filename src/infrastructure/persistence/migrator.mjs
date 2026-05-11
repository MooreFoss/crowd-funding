import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_ADVISORY_LOCK_CLASS_ID = 1_037_001;
const DEFAULT_ADVISORY_LOCK_OBJECT_ID = 1;

function calculateChecksum(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

async function readMigrationFiles(migrationsDirectory) {
  const fileNames = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  return Promise.all(
    fileNames.map(async (fileName) => {
      const sql = await readFile(join(migrationsDirectory, fileName), "utf8");

      return {
        fileName,
        sql,
        checksum: calculateChecksum(sql),
      };
    }),
  );
}

async function ensureMigrationTable(client) {
  await client.query(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
}

async function loadAppliedMigrations(client) {
  const result = await client.query(
    "SELECT filename, checksum FROM schema_migrations ORDER BY filename",
  );

  return new Map(
    result.rows.map((row) => [String(row.filename), String(row.checksum)]),
  );
}

async function applyMigration(client, migration) {
  await client.query("BEGIN");

  try {
    await client.query(migration.sql);
    await client.query(
      `
INSERT INTO schema_migrations (filename, checksum)
VALUES ($1, $2)
ON CONFLICT (filename) DO NOTHING`,
      [migration.fileName, migration.checksum],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function runDatabaseMigrations({
  client,
  migrationsDirectory,
  logger = console,
  advisoryLockClassId = DEFAULT_ADVISORY_LOCK_CLASS_ID,
  advisoryLockObjectId = DEFAULT_ADVISORY_LOCK_OBJECT_ID,
}) {
  const applied = [];
  const skipped = [];

  await client.query("SELECT pg_advisory_lock($1, $2)", [
    advisoryLockClassId,
    advisoryLockObjectId,
  ]);

  try {
    await ensureMigrationTable(client);

    const migrationFiles = await readMigrationFiles(migrationsDirectory);
    const appliedMigrations = await loadAppliedMigrations(client);

    for (const migration of migrationFiles) {
      const appliedChecksum = appliedMigrations.get(migration.fileName);

      if (appliedChecksum === migration.checksum) {
        skipped.push(migration.fileName);
        logger.info(`Skipping already applied migration ${migration.fileName}`);
        continue;
      }

      if (appliedChecksum) {
        throw new Error(
          `Migration ${migration.fileName} was already applied with a different checksum.`,
        );
      }

      logger.info(`Applying migration ${migration.fileName}`);
      await applyMigration(client, migration);
      applied.push(migration.fileName);
    }

    return { applied, skipped };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1, $2)", [
      advisoryLockClassId,
      advisoryLockObjectId,
    ]);
  }
}
