export type CampaignStatus =
  | "ACTIVE"
  | "CLOSING"
  | "REFUNDING"
  | "ENDED"
  | "SETTLED";

export type CloseoutSnapshotPledge = {
  pledgeId: string;
  merchantOrderNo: string;
  netAmountFen: number;
  userKey: string;
};

export type CampaignCloseSnapshot = {
  snapshotId: string;
  capturedAt: string;
  totalEligibleNetFen: number;
  totalExpenseFen?: number;
  refundableBalanceFen?: number;
  pledges: CloseoutSnapshotPledge[];
};

export type CampaignStateRecord = {
  id: string;
  status: CampaignStatus;
  closeReason: string | null;
  closeSnapshot: CampaignCloseSnapshot | null;
  closeSnapshotAt: Date | null;
  closedAt: Date | null;
  closedBy: string | null;
  refundBatchNo: string | null;
  refundProgress: Record<string, unknown> | null;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SaveCampaignStateInput = {
  id: string;
  status: CampaignStatus;
  closeReason: string | null;
  closeSnapshot: CampaignCloseSnapshot | null;
  closeSnapshotAt: Date | null;
  closedAt: Date | null;
  closedBy: string | null;
  refundBatchNo: string | null;
  refundProgress: Record<string, unknown> | null;
  settledAt: Date | null;
};

export type SaveCloseSnapshotInput = {
  campaignId: string;
  closeReason: string;
  closedBy: string;
  closedAt: Date;
  snapshot: CampaignCloseSnapshot;
};

export type UpdateCampaignRefundProgressInput = {
  campaignId: string;
  status: CampaignStatus;
  refundBatchNo: string | null;
  refundProgress: Record<string, unknown> | null;
  settledAt?: Date | null;
};

export interface CampaignStateRepository {
  save(input: SaveCampaignStateInput): Promise<CampaignStateRecord>;
  findById(id: string): Promise<CampaignStateRecord | null>;
  findCurrent(): Promise<CampaignStateRecord | null>;
  saveCloseSnapshot(
    input: SaveCloseSnapshotInput,
  ): Promise<CampaignStateRecord>;
  updateRefundProgress(
    input: UpdateCampaignRefundProgressInput,
  ): Promise<CampaignStateRecord>;
}
