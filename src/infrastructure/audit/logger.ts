import "server-only";

import type { AppendAuditLogInput, AuditLogRepository } from "@/src/domain/audit";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import { createAuditLogRepository } from "@/src/infrastructure/persistence/repositories";

type AuditLoggerRepositoriesInput = {
  auditLogs?: AuditLogRepository;
  executor?: DatabaseExecutor;
};

function resolveAuditRepository(input?: AuditLoggerRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return input?.auditLogs ?? createAuditLogRepository(executor);
}

export async function logAuditEvent(
  input: AppendAuditLogInput,
  repositories?: AuditLoggerRepositoriesInput,
) {
  return resolveAuditRepository(repositories).append(input);
}

export async function logAuditEventIdempotent(
  input: AppendAuditLogInput,
  repositories?: AuditLoggerRepositoriesInput,
) {
  return resolveAuditRepository(repositories).appendIdempotent(input);
}
