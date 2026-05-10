export type AuditActorType = "ADMIN" | "SYSTEM" | "USER";

export type AuditLogRecord = {
  id: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeSummary: Record<string, unknown> | null;
  afterSummary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  idempotencyKey: string | null;
  occurredAt: Date;
};

export type AppendAuditLogInput = {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeSummary?: Record<string, unknown> | null;
  afterSummary?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  occurredAt?: Date;
};

export type AppendAuditLogResult = {
  inserted: boolean;
  record: AuditLogRecord;
};

export type ListAuditLogsByTargetInput = {
  targetType: string;
  targetId: string;
};

export type ListAuditLogsInput = {
  targetType?: string | null;
  targetId?: string | null;
  action?: string | null;
  limit?: number;
  offset?: number;
};

export interface AuditLogRepository {
  append(input: AppendAuditLogInput): Promise<AuditLogRecord>;
  appendIdempotent(input: AppendAuditLogInput): Promise<AppendAuditLogResult>;
  list(input?: ListAuditLogsInput): Promise<AuditLogRecord[]>;
  listByTarget(input: ListAuditLogsByTargetInput): Promise<AuditLogRecord[]>;
}
