import type { DatabaseExecutor } from "../client";

export type RepositoryExecutor = DatabaseExecutor;

export function parseDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function parseOptionalDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  return parseDate(value);
}

export function parseJsonValue<Value>(
  value: Value | string | null,
): Value | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as Value;
  }

  return value;
}

export function serializeJsonValue(
  value: Record<string, unknown> | unknown[] | null,
) {
  return value === null ? null : JSON.stringify(value);
}

export function resolvePagination(options?: {
  limit?: number;
  offset?: number;
}) {
  return {
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  };
}

export function requireRow<Row>(
  row: Row | undefined,
  message: string,
): Row {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
