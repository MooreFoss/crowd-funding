import { randomUUID } from "node:crypto";

import type {
  CreateModerationReviewInput,
  ModerationFieldName,
  ModerationReviewRecord,
  ModerationReviewRepository,
  ModerationStatus,
  ModerationSubjectType,
  UpdateModerationReviewResultInput,
} from "@/src/domain/pledges";

import type { RepositoryExecutor } from "./shared";
import { parseDate, parseOptionalDate, requireRow } from "./shared";

type ModerationReviewRow = {
  id: string;
  subject_type: ModerationSubjectType;
  subject_id: string;
  field_name: ModerationFieldName;
  provider: "TENCENT_TMS";
  request_id: string | null;
  submitted_text: string;
  status: ModerationStatus;
  failure_summary: string | null;
  reviewed_at: Date | string | null;
  retry_count: number;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapModerationReviewRow(
  row: ModerationReviewRow,
): ModerationReviewRecord {
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    fieldName: row.field_name,
    provider: row.provider,
    requestId: row.request_id,
    submittedText: row.submitted_text,
    status: row.status,
    failureSummary: row.failure_summary,
    reviewedAt: parseOptionalDate(row.reviewed_at),
    retryCount: row.retry_count,
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

export function createModerationReviewRepository(
  executor: RepositoryExecutor,
  idFactory: () => string = randomUUID,
): ModerationReviewRepository {
  return {
    async create(input: CreateModerationReviewInput) {
      const now = new Date();
      const { rows } = await executor.query<ModerationReviewRow>(
        `INSERT INTO moderation_reviews (
          id,
          subject_type,
          subject_id,
          field_name,
          provider,
          request_id,
          submitted_text,
          status,
          failure_summary,
          reviewed_at,
          retry_count,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, 'TENCENT_TMS', $5, $6, $7, $8, $9, $10, $11, $11
        )
        RETURNING *`,
        [
          idFactory(),
          input.subjectType,
          input.subjectId,
          input.fieldName,
          input.requestId ?? null,
          input.submittedText,
          input.status,
          input.failureSummary ?? null,
          input.reviewedAt ?? null,
          input.retryCount ?? 0,
          now,
        ],
      );

      return mapModerationReviewRow(rows[0]);
    },

    async findById(id: string) {
      const { rows } = await executor.query<ModerationReviewRow>(
        "SELECT * FROM moderation_reviews WHERE id = $1",
        [id],
      );

      return rows[0] ? mapModerationReviewRow(rows[0]) : null;
    },

    async findLatestForField(subjectType, subjectId, fieldName) {
      const { rows } = await executor.query<ModerationReviewRow>(
        `SELECT *
         FROM moderation_reviews
         WHERE subject_type = $1
           AND subject_id = $2
           AND field_name = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [subjectType, subjectId, fieldName],
      );

      return rows[0] ? mapModerationReviewRow(rows[0]) : null;
    },

    async listBySubject(subjectType, subjectId) {
      const { rows } = await executor.query<ModerationReviewRow>(
        `SELECT *
         FROM moderation_reviews
         WHERE subject_type = $1
           AND subject_id = $2
         ORDER BY created_at DESC`,
        [subjectType, subjectId],
      );

      return rows.map(mapModerationReviewRow);
    },

    async updateResult(input: UpdateModerationReviewResultInput) {
      const { rows } = await executor.query<ModerationReviewRow>(
        `UPDATE moderation_reviews
         SET status = $2,
             failure_summary = $3,
             reviewed_at = $4,
             retry_count = $5,
             request_id = COALESCE($6, request_id),
             updated_at = $7
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          input.status,
          input.failureSummary ?? null,
          input.reviewedAt ?? null,
          input.retryCount ?? 0,
          input.requestId ?? null,
          new Date(),
        ],
      );

      return mapModerationReviewRow(
        requireRow(
          rows[0],
          `Moderation review ${input.id} was not found.`,
        ),
      );
    },
  };
}
