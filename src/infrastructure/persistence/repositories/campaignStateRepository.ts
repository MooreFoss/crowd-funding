import type {
  CampaignCloseSnapshot,
  CampaignStateRecord,
  CampaignStateRepository,
  CampaignStatus,
  SaveCampaignStateInput,
  SaveCloseSnapshotInput,
  UpdateCampaignRefundProgressInput,
} from "@/src/domain/funding";

import type { RepositoryExecutor } from "./shared";
import {
  parseDate,
  parseJsonValue,
  parseOptionalDate,
  serializeJsonValue,
} from "./shared";

type CampaignStateRow = {
  id: string;
  status: CampaignStatus;
  close_reason: string | null;
  close_snapshot: CampaignCloseSnapshot | string | null;
  close_snapshot_at: Date | string | null;
  closed_at: Date | string | null;
  closed_by: string | null;
  refund_batch_no: string | null;
  refund_progress: Record<string, unknown> | string | null;
  settled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapCampaignStateRow(row: CampaignStateRow): CampaignStateRecord {
  return {
    id: row.id,
    status: row.status,
    closeReason: row.close_reason,
    closeSnapshot: parseJsonValue<CampaignCloseSnapshot>(row.close_snapshot),
    closeSnapshotAt: parseOptionalDate(row.close_snapshot_at),
    closedAt: parseOptionalDate(row.closed_at),
    closedBy: row.closed_by,
    refundBatchNo: row.refund_batch_no,
    refundProgress: parseJsonValue<Record<string, unknown>>(row.refund_progress),
    settledAt: parseOptionalDate(row.settled_at),
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

export function createCampaignStateRepository(
  executor: RepositoryExecutor,
): CampaignStateRepository {
  return {
    async save(input: SaveCampaignStateInput) {
      const now = new Date();
      const { rows } = await executor.query<CampaignStateRow>(
        `INSERT INTO campaign_state (
          id,
          status,
          close_reason,
          close_snapshot,
          close_snapshot_at,
          closed_at,
          closed_by,
          refund_batch_no,
          refund_progress,
          settled_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11
        )
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          close_reason = EXCLUDED.close_reason,
          close_snapshot = EXCLUDED.close_snapshot,
          close_snapshot_at = EXCLUDED.close_snapshot_at,
          closed_at = EXCLUDED.closed_at,
          closed_by = EXCLUDED.closed_by,
          refund_batch_no = EXCLUDED.refund_batch_no,
          refund_progress = EXCLUDED.refund_progress,
          settled_at = EXCLUDED.settled_at,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          input.id,
          input.status,
          input.closeReason,
          serializeJsonValue(input.closeSnapshot as unknown[] | Record<string, unknown> | null),
          input.closeSnapshotAt,
          input.closedAt,
          input.closedBy,
          input.refundBatchNo,
          serializeJsonValue(input.refundProgress),
          input.settledAt,
          now,
        ],
      );

      return mapCampaignStateRow(rows[0]);
    },

    async findById(id: string) {
      const { rows } = await executor.query<CampaignStateRow>(
        "SELECT * FROM campaign_state WHERE id = $1",
        [id],
      );

      return rows[0] ? mapCampaignStateRow(rows[0]) : null;
    },

    async findCurrent() {
      const { rows } = await executor.query<CampaignStateRow>(
        `SELECT *
         FROM campaign_state
         ORDER BY updated_at DESC, created_at DESC
         LIMIT 1`,
      );

      return rows[0] ? mapCampaignStateRow(rows[0]) : null;
    },

    async saveCloseSnapshot(input: SaveCloseSnapshotInput) {
      const now = new Date();
      const { rows } = await executor.query<CampaignStateRow>(
        `INSERT INTO campaign_state (
          id,
          status,
          close_reason,
          close_snapshot,
          close_snapshot_at,
          closed_at,
          closed_by,
          refund_batch_no,
          refund_progress,
          settled_at,
          created_at,
          updated_at
        ) VALUES (
          $1, 'CLOSING', $2, $3, $4, $5, $6, NULL, NULL, NULL, $7, $7
        )
        ON CONFLICT (id)
        DO UPDATE SET
          status = 'CLOSING',
          close_reason = EXCLUDED.close_reason,
          close_snapshot = EXCLUDED.close_snapshot,
          close_snapshot_at = EXCLUDED.close_snapshot_at,
          closed_at = EXCLUDED.closed_at,
          closed_by = EXCLUDED.closed_by,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          input.campaignId,
          input.closeReason,
          serializeJsonValue(input.snapshot as unknown[] | Record<string, unknown>),
          new Date(input.snapshot.capturedAt),
          input.closedAt,
          input.closedBy,
          now,
        ],
      );

      return mapCampaignStateRow(rows[0]);
    },

    async updateRefundProgress(input: UpdateCampaignRefundProgressInput) {
      const now = new Date();
      const { rows } = await executor.query<CampaignStateRow>(
        `INSERT INTO campaign_state (
          id,
          status,
          close_reason,
          close_snapshot,
          close_snapshot_at,
          closed_at,
          closed_by,
          refund_batch_no,
          refund_progress,
          settled_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, NULL, NULL, NULL, NULL, NULL, $3, $4, $5, $6, $6
        )
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          refund_batch_no = EXCLUDED.refund_batch_no,
          refund_progress = EXCLUDED.refund_progress,
          settled_at = EXCLUDED.settled_at,
          updated_at = EXCLUDED.updated_at
        RETURNING *`,
        [
          input.campaignId,
          input.status,
          input.refundBatchNo,
          serializeJsonValue(input.refundProgress),
          input.settledAt ?? null,
          now,
        ],
      );

      return mapCampaignStateRow(rows[0]);
    },
  };
}
