import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { serverEnv } from "@/src/config/env";

declare global {
  var crowdFundingDatabasePool: Pool | undefined;
}

function createDatabasePool() {
  return new Pool({
    connectionString: serverEnv.databaseUrl,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });
}

export function getDatabasePool() {
  globalThis.crowdFundingDatabasePool ??= createDatabasePool();

  return globalThis.crowdFundingDatabasePool;
}

export function queryDatabase<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
) {
  return getDatabasePool().query<T>(text, values);
}
