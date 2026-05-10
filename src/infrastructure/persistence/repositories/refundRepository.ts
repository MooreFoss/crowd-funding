import { randomUUID } from "node:crypto";

import type {
  CreateRefundInput,
  MarkRefundStatusInput,
  RefundRecord,
  RefundRepository,
  RefundStatus,
} from "@/src/domain/refunds";

import type { RepositoryExecutor } from "./shared";
import { parseDate, parseOptionalDate } from "./shared";

type RefundRow = {
  id: string;
  pledge_id: string;
  merchant_refund_no: string;
  provider_refund_no: string | null;
  batch_no: string | null;
  close_snapshot_id: string | null;
  allocation_order: number | null;
  amount_fen: number;
  reason: string;
  status: RefundStatus;
  requested_by: string;
  requested_at: Date | string;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapRefundRow(row: RefundRow): RefundRecord {
  return {
    id: row.id,
    pledgeId: row.pledge_id,
    merchantRefundNo: row.merchant_refund_no,
    providerRefundNo: row.provider_refund_no,
    batchNo: row.batch_no,
    closeSnapshotId: row.close_snapshot_id,
    allocationOrder: row.allocation_order,
    amountFen: row.amount_fen,
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: parseDate(row.requested_at),
    completedAt: parseOptionalDate(row.completed_at),
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

export function createRefundRepository(
  executor: RepositoryExecutor,
  idFactory: () => string = randomUUID,
): RefundRepository {
  return {
    async create(input: CreateRefundInput) {
      const now = new Date();
      const { rows } = await executor.query<RefundRow>(
        `INSERT INTO refunds (
          id,
          pledge_id,
          merchant_refund_no,
          provider_refund_no,
          batch_no,
          close_snapshot_id,
          allocation_order,
          amount_fen,
          reason,
          status,
          requested_by,
          requested_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $11, $11
        )
        RETURNING *`,
        [
          idFactory(),
          input.pledgeId,
          input.merchantRefundNo,
          input.batchNo ?? null,
          input.closeSnapshotId ?? null,
          input.allocationOrder ?? null,
          input.amountFen,
          input.reason,
          input.status,
          input.requestedBy,
          now,
        ],
      );

      return mapRefundRow(rows[0]);
    },

    async findById(id: string) {
      const { rows } = await executor.query<RefundRow>(
        "SELECT * FROM refunds WHERE id = $1",
        [id],
      );

      return rows[0] ? mapRefundRow(rows[0]) : null;
    },

    async findByMerchantRefundNo(merchantRefundNo: string) {
      const { rows } = await executor.query<RefundRow>(
        "SELECT * FROM refunds WHERE merchant_refund_no = $1",
        [merchantRefundNo],
      );

      return rows[0] ? mapRefundRow(rows[0]) : null;
    },

    async listByPledgeId(pledgeId: string) {
      const { rows } = await executor.query<RefundRow>(
        `SELECT *
         FROM refunds
         WHERE pledge_id = $1
         ORDER BY created_at DESC`,
        [pledgeId],
      );

      return rows.map(mapRefundRow);
    },

    async listByBatchNo(batchNo: string) {
      const { rows } = await executor.query<RefundRow>(
        `SELECT *
         FROM refunds
         WHERE batch_no = $1
         ORDER BY created_at ASC, merchant_refund_no ASC`,
        [batchNo],
      );

      return rows.map(mapRefundRow);
    },

    async listAll() {
      const { rows } = await executor.query<RefundRow>(
        `SELECT *
         FROM refunds
         ORDER BY created_at DESC`,
      );

      return rows.map(mapRefundRow);
    },

    async markStatus(input: MarkRefundStatusInput) {
      const current = await this.findByMerchantRefundNo(input.merchantRefundNo);

      if (!current) {
        throw new Error(`Refund ${input.merchantRefundNo} was not found.`);
      }

      const { rows } = await executor.query<RefundRow>(
        `UPDATE refunds
         SET status = $2,
             provider_refund_no = COALESCE($3, provider_refund_no),
             completed_at = $4,
             updated_at = $5
         WHERE merchant_refund_no = $1
         RETURNING *`,
        [
          input.merchantRefundNo,
          input.status,
          input.providerRefundNo ?? current.providerRefundNo,
          input.completedAt ?? current.completedAt,
          new Date(),
        ],
      );

      return mapRefundRow(rows[0]);
    },

    async sumSuccessfulRefundsForPledge(pledgeId: string) {
      const { rows } = await executor.query<{
        refunded_fen: number | null;
      }>(
        `SELECT COALESCE(SUM(amount_fen), 0) AS refunded_fen
         FROM refunds
         WHERE pledge_id = $1
           AND status = 'SUCCEEDED'`,
        [pledgeId],
      );

      return rows[0]?.refunded_fen ?? 0;
    },
  };
}
