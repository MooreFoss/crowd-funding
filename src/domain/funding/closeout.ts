import type { CampaignStateRecord } from "./model";

export function isCampaignAcceptingSponsors(
  campaignState: CampaignStateRecord | null,
) {
  return !campaignState || campaignState.status === "ACTIVE";
}

export function getCloseoutRefundTotalFen(snapshot: {
  totalEligibleNetFen: number;
  refundableBalanceFen?: number;
}) {
  return Math.max(
    0,
    Math.min(
      snapshot.totalEligibleNetFen,
      Math.trunc(snapshot.refundableBalanceFen ?? snapshot.totalEligibleNetFen),
    ),
  );
}
