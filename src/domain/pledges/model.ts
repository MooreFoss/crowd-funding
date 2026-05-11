export type PaymentChannel =
  | "WECHATPAY_MINI_PROGRAM"
  | "WECHATPAY_NATIVE"
  | "ZPAY_WECHAT_H5";

export type PledgeStatus =
  | "PENDING"
  | "PAYING"
  | "PAID"
  | "CANCELLED"
  | "FAILED"
  | "PARTIAL_REFUNDED"
  | "REFUNDED"
  | "CLOSED";

export type ModerationSubjectType = "PLEDGE" | "PLEDGE_EDIT";
export type ModerationFieldName = "DISPLAY_NAME" | "MESSAGE";
export type ModerationStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVIEW_ERROR";

export type PledgeRecord = {
  id: string;
  merchantOrderNo: string;
  paymentChannel: PaymentChannel;
  providerOrderNo: string | null;
  userKey: string;
  submittedName: string | null;
  publicName: string | null;
  submittedMessage: string | null;
  publicMessage: string | null;
  amountFen: number;
  refundedFen: number;
  netAmountFen: number;
  status: PledgeStatus;
  paymentRedirectUrl: string | null;
  termsVersionId: string | null;
  termsAcceptedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePendingPledgeInput = {
  merchantOrderNo: string;
  paymentChannel: PaymentChannel;
  userKey: string;
  submittedName: string | null;
  publicName: string | null;
  submittedMessage: string | null;
  publicMessage: string | null;
  amountFen: number;
  paymentRedirectUrl: string | null;
  termsVersionId: string | null;
  termsAcceptedAt: Date | null;
};

export type MarkPaymentOutcomeInput = {
  merchantOrderNo: string;
  providerOrderNo: string | null;
  status: Extract<PledgeStatus, "PAYING" | "PAID" | "CANCELLED" | "FAILED">;
  paymentRedirectUrl?: string | null;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  failedAt?: Date | null;
};

export type ApplySuccessfulRefundInput = {
  pledgeId: string;
  amountFen: number;
};

export type UpdatePledgePublicTextInput = {
  pledgeId: string;
  publicName: string | null;
  publicMessage: string | null;
};

export type ListPledgesOptions = {
  limit?: number;
  offset?: number;
};

export type PledgeMetrics = {
  totalRaisedFen: number;
  totalNetFen: number;
  sponsorCount: number;
};

export type CloseoutEligiblePledge = {
  id: string;
  merchantOrderNo: string;
  userKey: string;
  netAmountFen: number;
};

export interface PledgeRepository {
  createPending(input: CreatePendingPledgeInput): Promise<PledgeRecord>;
  findById(id: string): Promise<PledgeRecord | null>;
  findByMerchantOrderNo(
    merchantOrderNo: string,
  ): Promise<PledgeRecord | null>;
  listPublic(options?: ListPledgesOptions): Promise<PledgeRecord[]>;
  listAdmin(options?: ListPledgesOptions): Promise<PledgeRecord[]>;
  markPaymentOutcome(input: MarkPaymentOutcomeInput): Promise<PledgeRecord>;
  applySuccessfulRefund(
    input: ApplySuccessfulRefundInput,
  ): Promise<PledgeRecord>;
  updatePublicText(input: UpdatePledgePublicTextInput): Promise<PledgeRecord>;
  summarizePublicMetrics(): Promise<PledgeMetrics>;
  listEligibleForCloseout(): Promise<CloseoutEligiblePledge[]>;
}

export type ModerationReviewRecord = {
  id: string;
  subjectType: ModerationSubjectType;
  subjectId: string;
  fieldName: ModerationFieldName;
  provider: "TENCENT_TMS";
  requestId: string | null;
  submittedText: string;
  status: ModerationStatus;
  failureSummary: string | null;
  reviewedAt: Date | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateModerationReviewInput = {
  subjectType: ModerationSubjectType;
  subjectId: string;
  fieldName: ModerationFieldName;
  status: ModerationStatus;
  submittedText: string;
  requestId?: string | null;
  failureSummary?: string | null;
  reviewedAt?: Date | null;
  retryCount?: number;
};

export type UpdateModerationReviewResultInput = {
  id: string;
  status: ModerationStatus;
  failureSummary?: string | null;
  reviewedAt?: Date | null;
  retryCount?: number;
  requestId?: string | null;
};

export interface ModerationReviewRepository {
  create(input: CreateModerationReviewInput): Promise<ModerationReviewRecord>;
  findById(id: string): Promise<ModerationReviewRecord | null>;
  findLatestForField(
    subjectType: ModerationSubjectType,
    subjectId: string,
    fieldName: ModerationFieldName,
  ): Promise<ModerationReviewRecord | null>;
  listBySubject(
    subjectType: ModerationSubjectType,
    subjectId: string,
  ): Promise<ModerationReviewRecord[]>;
  updateResult(
    input: UpdateModerationReviewResultInput,
  ): Promise<ModerationReviewRecord>;
}
