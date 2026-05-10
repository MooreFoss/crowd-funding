export type RefundStatus =
  | "CREATED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "REFUND_CLOSED"
  | "EXCEPTION";

export type RefundRecord = {
  id: string;
  pledgeId: string;
  merchantRefundNo: string;
  providerRefundNo: string | null;
  batchNo: string | null;
  closeSnapshotId: string | null;
  allocationOrder: number | null;
  amountFen: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateRefundInput = {
  pledgeId: string;
  merchantRefundNo: string;
  amountFen: number;
  reason: string;
  requestedBy: string;
  status: RefundStatus;
  batchNo?: string | null;
  closeSnapshotId?: string | null;
  allocationOrder?: number | null;
};

export type MarkRefundStatusInput = {
  merchantRefundNo: string;
  status: RefundStatus;
  providerRefundNo?: string | null;
  completedAt?: Date | null;
};

export interface RefundRepository {
  create(input: CreateRefundInput): Promise<RefundRecord>;
  findById(id: string): Promise<RefundRecord | null>;
  findByMerchantRefundNo(
    merchantRefundNo: string,
  ): Promise<RefundRecord | null>;
  listByPledgeId(pledgeId: string): Promise<RefundRecord[]>;
  listByBatchNo(batchNo: string): Promise<RefundRecord[]>;
  listAll(): Promise<RefundRecord[]>;
  markStatus(input: MarkRefundStatusInput): Promise<RefundRecord>;
  sumSuccessfulRefundsForPledge(pledgeId: string): Promise<number>;
}
