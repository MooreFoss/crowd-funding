import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { runDatabaseMigrations } from "../../../src/infrastructure/persistence/migrator.mjs";

interface QueryCall {
  text: string;
  values?: unknown[];
}

function createFakeClient(appliedRows: Array<{ filename: string; checksum: string }> = []) {
  const calls: QueryCall[] = [];

  return {
    calls,
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (text.includes("SELECT filename, checksum FROM schema_migrations")) {
        return { rows: appliedRows };
      }

      return { rows: [] };
    },
  };
}

async function createMigrationDirectory(files: Record<string, string>) {
  const directory = join(
    tmpdir(),
    `crowd-funding-migrator-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(directory, { recursive: true });

  for (const [fileName, sql] of Object.entries(files)) {
    await writeFile(join(directory, fileName), sql, "utf8");
  }

  return directory;
}

describe("runDatabaseMigrations", () => {
  it("applies pending SQL migrations in filename order under an advisory lock", async () => {
    const migrationsDirectory = await createMigrationDirectory({
      "0002_second.sql": "CREATE TABLE second_table (id TEXT PRIMARY KEY);",
      "0001_first.sql": "CREATE TABLE first_table (id TEXT PRIMARY KEY);",
      "notes.md": "not a migration",
    });
    const client = createFakeClient();

    const result = await runDatabaseMigrations({
      client,
      migrationsDirectory,
      logger: { info() {}, warn() {}, error() {} },
    });

    expect(result).toMatchObject({
      applied: ["0001_first.sql", "0002_second.sql"],
      skipped: [],
    });
    expect(client.calls.map((call) => call.text)).toEqual([
      "SELECT pg_advisory_lock($1, $2)",
      expect.stringContaining("CREATE TABLE IF NOT EXISTS schema_migrations"),
      "SELECT filename, checksum FROM schema_migrations ORDER BY filename",
      "BEGIN",
      "CREATE TABLE first_table (id TEXT PRIMARY KEY);",
      expect.stringContaining("INSERT INTO schema_migrations"),
      "COMMIT",
      "BEGIN",
      "CREATE TABLE second_table (id TEXT PRIMARY KEY);",
      expect.stringContaining("INSERT INTO schema_migrations"),
      "COMMIT",
      "SELECT pg_advisory_unlock($1, $2)",
    ]);
    expect(client.calls[5].values?.[0]).toBe("0001_first.sql");
    expect(client.calls[9].values?.[0]).toBe("0002_second.sql");
  });

  it("skips migrations that were already applied with the same checksum", async () => {
    const sql = "CREATE TABLE already_done (id TEXT PRIMARY KEY);";
    const migrationsDirectory = await createMigrationDirectory({
      "0001_already_done.sql": sql,
    });
    const firstClient = createFakeClient();
    const firstRun = await runDatabaseMigrations({
      client: firstClient,
      migrationsDirectory,
      logger: { info() {}, warn() {}, error() {} },
    });
    const checksum = String(firstClient.calls.find((call) =>
      call.text.includes("INSERT INTO schema_migrations"),
    )?.values?.[1]);
    const secondClient = createFakeClient([
      { filename: "0001_already_done.sql", checksum },
    ]);

    const secondRun = await runDatabaseMigrations({
      client: secondClient,
      migrationsDirectory,
      logger: { info() {}, warn() {}, error() {} },
    });

    expect(firstRun.applied).toEqual(["0001_already_done.sql"]);
    expect(secondRun).toMatchObject({
      applied: [],
      skipped: ["0001_already_done.sql"],
    });
    expect(secondClient.calls.map((call) => call.text)).not.toContain(sql);
  });

  it("rejects an applied migration whose SQL checksum has changed", async () => {
    const migrationsDirectory = await createMigrationDirectory({
      "0001_changed.sql": "CREATE TABLE changed_table (id TEXT PRIMARY KEY);",
    });
    const client = createFakeClient([
      { filename: "0001_changed.sql", checksum: "old-checksum" },
    ]);

    await expect(
      runDatabaseMigrations({
        client,
        migrationsDirectory,
        logger: { info() {}, warn() {}, error() {} },
      }),
    ).rejects.toThrow(
      "Migration 0001_changed.sql was already applied with a different checksum.",
    );
    expect(client.calls.at(-1)?.text).toBe("SELECT pg_advisory_unlock($1, $2)");
  });
});
