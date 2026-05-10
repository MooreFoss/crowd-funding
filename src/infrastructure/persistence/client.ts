import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { serverEnv } from "@/src/config/env";

declare global {
  var crowdFundingDatabasePool: Pool | undefined;
}

export interface DatabaseExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
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

export async function withDatabaseClient<Result>(
  callback: (client: PoolClient) => Promise<Result>,
) {
  const client = await getDatabasePool().connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export function queryDatabase<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
) {
  return getDatabasePool().query<T>(text, values);
}
