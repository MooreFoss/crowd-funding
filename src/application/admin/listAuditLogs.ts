import type { AuditLogRepository, ListAuditLogsInput } from "@/src/domain/audit";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import { createAuditLogRepository } from "@/src/infrastructure/persistence/repositories";

type AuditRepositoriesInput = {
  auditLogs?: AuditLogRepository;
  executor?: DatabaseExecutor;
};

function resolveAuditRepository(input?: AuditRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return input?.auditLogs ?? createAuditLogRepository(executor);
}

export async function listAuditLogs(
  input: ListAuditLogsInput = {},
  repositories?: AuditRepositoriesInput,
) {
  const auditLogs = resolveAuditRepository(repositories);
  const records = await auditLogs.list(input);

  return {
    items: records.map((record) => ({
      id: record.id,
      actorType: record.actorType,
      actorId: record.actorId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      beforeSummary: record.beforeSummary,
      afterSummary: record.afterSummary,
      metadata: record.metadata,
      idempotencyKey: record.idempotencyKey,
      occurredAt: record.occurredAt.toISOString(),
    })),
  };
}
