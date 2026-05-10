import { randomUUID } from "node:crypto";

import type {
  AppendAuditLogInput,
  AppendAuditLogResult,
  AuditActorType,
  AuditLogRecord,
  AuditLogRepository,
  ListAuditLogsByTargetInput,
} from "@/src/domain/audit";

import type { RepositoryExecutor } from "./shared";
import {
  parseDate,
  parseJsonValue,
  requireRow,
  serializeJsonValue,
} from "./shared";

type AuditLogRow = {
  id: string;
  actor_type: AuditActorType;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  before_summary: Record<string, unknown> | string | null;
  after_summary: Record<string, unknown> | string | null;
  metadata: Record<string, unknown> | string | null;
  idempotency_key: string | null;
  occurred_at: Date | string;
};

function mapAuditLogRow(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    beforeSummary: parseJsonValue<Record<string, unknown>>(row.before_summary),
    afterSummary: parseJsonValue<Record<string, unknown>>(row.after_summary),
    metadata: parseJsonValue<Record<string, unknown>>(row.metadata),
    idempotencyKey: row.idempotency_key,
    occurredAt: parseDate(row.occurred_at),
  };
}

function buildAuditInsertValues(
  input: AppendAuditLogInput,
  idFactory: () => string,
) {
  return {
    id: idFactory(),
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    beforeSummary: serializeJsonValue(input.beforeSummary ?? null),
    afterSummary: serializeJsonValue(input.afterSummary ?? null),
    metadata: serializeJsonValue(input.metadata ?? null),
    idempotencyKey: input.idempotencyKey ?? null,
    occurredAt: input.occurredAt ?? new Date(),
  };
}

export function createAuditLogRepository(
  executor: RepositoryExecutor,
  idFactory: () => string = randomUUID,
): AuditLogRepository {
  return {
    async append(input: AppendAuditLogInput) {
      const values = buildAuditInsertValues(input, idFactory);
      const { rows } = await executor.query<AuditLogRow>(
        `INSERT INTO audit_logs (
          id,
          actor_type,
          actor_id,
          action,
          target_type,
          target_id,
          before_summary,
          after_summary,
          metadata,
          idempotency_key,
          occurred_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        RETURNING *`,
        [
          values.id,
          values.actorType,
          values.actorId,
          values.action,
          values.targetType,
          values.targetId,
          values.beforeSummary,
          values.afterSummary,
          values.metadata,
          values.idempotencyKey,
          values.occurredAt,
        ],
      );

      return mapAuditLogRow(rows[0]);
    },

    async appendIdempotent(input: AppendAuditLogInput) {
      if (!input.idempotencyKey) {
        return {
          inserted: true,
          record: await this.append(input),
        } satisfies AppendAuditLogResult;
      }

      const values = buildAuditInsertValues(input, idFactory);
      const { rows } = await executor.query<AuditLogRow>(
        `INSERT INTO audit_logs (
          id,
          actor_type,
          actor_id,
          action,
          target_type,
          target_id,
          before_summary,
          after_summary,
          metadata,
          idempotency_key,
          occurred_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *`,
        [
          values.id,
          values.actorType,
          values.actorId,
          values.action,
          values.targetType,
          values.targetId,
          values.beforeSummary,
          values.afterSummary,
          values.metadata,
          values.idempotencyKey,
          values.occurredAt,
        ],
      );

      if (rows[0]) {
        return {
          inserted: true,
          record: mapAuditLogRow(rows[0]),
        } satisfies AppendAuditLogResult;
      }

      const existing = await executor.query<AuditLogRow>(
        "SELECT * FROM audit_logs WHERE idempotency_key = $1",
        [input.idempotencyKey],
      );

      return {
        inserted: false,
        record: mapAuditLogRow(
          requireRow(
            existing.rows[0],
            `Audit log with key ${input.idempotencyKey} was not found after conflict.`,
          ),
        ),
      } satisfies AppendAuditLogResult;
    },

    async listByTarget(input: ListAuditLogsByTargetInput) {
      const { rows } = await executor.query<AuditLogRow>(
        `SELECT *
         FROM audit_logs
         WHERE target_type = $1
           AND target_id = $2
         ORDER BY occurred_at DESC, id DESC`,
        [input.targetType, input.targetId],
      );

      return rows.map(mapAuditLogRow);
    },
  };
}
