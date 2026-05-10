import { randomUUID } from "node:crypto";

import type {
  ApplySuccessfulRefundInput,
  CloseoutEligiblePledge,
  CreatePendingPledgeInput,
  ListPledgesOptions,
  MarkPaymentOutcomeInput,
  PaymentChannel,
  PledgeMetrics,
  PledgeRecord,
  PledgeRepository,
  PledgeStatus,
  UpdatePledgePublicTextInput,
} from "@/src/domain/pledges";

import type { RepositoryExecutor } from "./shared";
import {
  parseDate,
  parseOptionalDate,
  requireRow,
  resolvePagination,
} from "./shared";

type PledgeRow = {
  id: string;
  merchant_order_no: string;
  payment_channel: PaymentChannel;
  provider_order_no: string | null;
  user_key: string;
  submitted_name: string | null;
  public_name: string | null;
  submitted_message: string | null;
  public_message: string | null;
  amount_fen: number;
  refunded_fen: number;
  net_amount_fen: number;
  status: PledgeStatus;
  payment_redirect_url: string | null;
  terms_version_id: string | null;
  terms_accepted_at: Date | string | null;
  paid_at: Date | string | null;
  cancelled_at: Date | string | null;
  failed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapPledgeRow(row: PledgeRow): PledgeRecord {
  return {
    id: row.id,
    merchantOrderNo: row.merchant_order_no,
    paymentChannel: row.payment_channel,
    providerOrderNo: row.provider_order_no,
    userKey: row.user_key,
    submittedName: row.submitted_name,
    publicName: row.public_name,
    submittedMessage: row.submitted_message,
    publicMessage: row.public_message,
    amountFen: row.amount_fen,
    refundedFen: row.refunded_fen,
    netAmountFen: row.net_amount_fen,
    status: row.status,
    paymentRedirectUrl: row.payment_redirect_url,
    termsVersionId: row.terms_version_id,
    termsAcceptedAt: parseOptionalDate(row.terms_accepted_at),
    paidAt: parseOptionalDate(row.paid_at),
    cancelledAt: parseOptionalDate(row.cancelled_at),
    failedAt: parseOptionalDate(row.failed_at),
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

function resolvePaidStatus(
  amountFen: number,
  refundedFen: number,
): Extract<PledgeStatus, "PAID" | "PARTIAL_REFUNDED" | "REFUNDED"> {
  if (refundedFen <= 0) {
    return "PAID";
  }

  if (refundedFen >= amountFen) {
    return "REFUNDED";
  }

  return "PARTIAL_REFUNDED";
}

export function createPledgeRepository(
  executor: RepositoryExecutor,
  idFactory: () => string = randomUUID,
): PledgeRepository {
  return {
    async createPending(input: CreatePendingPledgeInput) {
      const now = new Date();
      const { rows } = await executor.query<PledgeRow>(
        `INSERT INTO pledges (
          id,
          merchant_order_no,
          payment_channel,
          provider_order_no,
          user_key,
          submitted_name,
          public_name,
          submitted_message,
          public_message,
          amount_fen,
          refunded_fen,
          net_amount_fen,
          status,
          payment_redirect_url,
          terms_version_id,
          terms_accepted_at,
          paid_at,
          cancelled_at,
          failed_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, 0, $9, 'PENDING', $10, $11, $12, NULL, NULL, NULL, $13, $13
        )
        RETURNING *`,
        [
          idFactory(),
          input.merchantOrderNo,
          input.paymentChannel,
          input.userKey,
          input.submittedName,
          input.publicName,
          input.submittedMessage,
          input.publicMessage,
          input.amountFen,
          input.paymentRedirectUrl,
          input.termsVersionId,
          input.termsAcceptedAt,
          now,
        ],
      );

      return mapPledgeRow(rows[0]);
    },

    async findById(id: string) {
      const { rows } = await executor.query<PledgeRow>(
        "SELECT * FROM pledges WHERE id = $1",
        [id],
      );

      return rows[0] ? mapPledgeRow(rows[0]) : null;
    },

    async findByMerchantOrderNo(merchantOrderNo: string) {
      const { rows } = await executor.query<PledgeRow>(
        "SELECT * FROM pledges WHERE merchant_order_no = $1",
        [merchantOrderNo],
      );

      return rows[0] ? mapPledgeRow(rows[0]) : null;
    },

    async listPublic(options?: ListPledgesOptions) {
      const { limit, offset } = resolvePagination(options);
      const { rows } = await executor.query<PledgeRow>(
        `SELECT *
         FROM pledges
         WHERE status IN ('PAID', 'PARTIAL_REFUNDED')
           AND net_amount_fen > 0
         ORDER BY COALESCE(paid_at, created_at) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      return rows.map(mapPledgeRow);
    },

    async listAdmin(options?: ListPledgesOptions) {
      const { limit, offset } = resolvePagination(options);
      const { rows } = await executor.query<PledgeRow>(
        `SELECT *
         FROM pledges
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      return rows.map(mapPledgeRow);
    },

    async markPaymentOutcome(input: MarkPaymentOutcomeInput) {
      const current = await this.findByMerchantOrderNo(input.merchantOrderNo);

      if (!current) {
        throw new Error(`Pledge ${input.merchantOrderNo} was not found.`);
      }

      const nextStatus =
        input.status === "PAID"
          ? resolvePaidStatus(current.amountFen, current.refundedFen)
          : input.status;
      const now = new Date();
      const { rows } = await executor.query<PledgeRow>(
        `UPDATE pledges
         SET provider_order_no = COALESCE($2, provider_order_no),
             payment_redirect_url = COALESCE($3, payment_redirect_url),
             status = $4,
             paid_at = $5,
             cancelled_at = $6,
             failed_at = $7,
             updated_at = $8
         WHERE merchant_order_no = $1
         RETURNING *`,
        [
          input.merchantOrderNo,
          input.providerOrderNo,
          input.paymentRedirectUrl ?? current.paymentRedirectUrl,
          nextStatus,
          nextStatus === "PAID"
            ? input.paidAt ?? current.paidAt ?? now
            : current.paidAt,
          nextStatus === "CANCELLED"
            ? input.cancelledAt ?? current.cancelledAt ?? now
            : current.cancelledAt,
          nextStatus === "FAILED"
            ? input.failedAt ?? current.failedAt ?? now
            : current.failedAt,
          now,
        ],
      );

      return mapPledgeRow(rows[0]);
    },

    async applySuccessfulRefund(input: ApplySuccessfulRefundInput) {
      const current = await this.findById(input.pledgeId);

      if (!current) {
        throw new Error(`Pledge ${input.pledgeId} was not found.`);
      }

      const refundedFen = current.refundedFen + input.amountFen;

      if (refundedFen > current.amountFen) {
        throw new Error(
          `Refund ${input.amountFen} exceeds available balance for pledge ${input.pledgeId}.`,
        );
      }

      const netAmountFen = current.amountFen - refundedFen;
      const { rows } = await executor.query<PledgeRow>(
        `UPDATE pledges
         SET refunded_fen = $2,
             net_amount_fen = $3,
             status = $4,
             updated_at = $5
         WHERE id = $1
         RETURNING *`,
        [
          input.pledgeId,
          refundedFen,
          netAmountFen,
          resolvePaidStatus(current.amountFen, refundedFen),
          new Date(),
        ],
      );

      return mapPledgeRow(rows[0]);
    },

    async updatePublicText(input: UpdatePledgePublicTextInput) {
      const { rows } = await executor.query<PledgeRow>(
        `UPDATE pledges
         SET public_name = $2,
             public_message = $3,
             updated_at = $4
         WHERE id = $1
         RETURNING *`,
        [input.pledgeId, input.publicName, input.publicMessage, new Date()],
      );

      return mapPledgeRow(
        requireRow(rows[0], `Pledge ${input.pledgeId} was not found.`),
      );
    },

    async summarizePublicMetrics() {
      const { rows } = await executor.query<{
        total_raised_fen: number | null;
        total_net_fen: number | null;
        sponsor_count: number | null;
      }>(
        `SELECT
           COALESCE(SUM(amount_fen), 0) AS total_raised_fen,
           COALESCE(SUM(net_amount_fen), 0) AS total_net_fen,
           COUNT(DISTINCT user_key) AS sponsor_count
         FROM pledges
         WHERE status IN ('PAID', 'PARTIAL_REFUNDED', 'REFUNDED')`,
      );
      const row = rows[0];

      return {
        totalRaisedFen: row?.total_raised_fen ?? 0,
        totalNetFen: row?.total_net_fen ?? 0,
        sponsorCount: row?.sponsor_count ?? 0,
      } satisfies PledgeMetrics;
    },

    async listEligibleForCloseout() {
      const { rows } = await executor.query<{
        id: string;
        merchant_order_no: string;
        user_key: string;
        net_amount_fen: number;
      }>(
        `SELECT id, merchant_order_no, user_key, net_amount_fen
         FROM pledges
         WHERE status IN ('PAID', 'PARTIAL_REFUNDED')
           AND net_amount_fen > 0
         ORDER BY created_at ASC, merchant_order_no ASC`,
      );

      return rows.map(
        (row): CloseoutEligiblePledge => ({
          id: row.id,
          merchantOrderNo: row.merchant_order_no,
          userKey: row.user_key,
          netAmountFen: row.net_amount_fen,
        }),
      );
    },
  };
}
