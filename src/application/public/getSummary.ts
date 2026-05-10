import type { CampaignStatus } from "@/src/domain/funding";

import {
  resolvePublicRepositories,
  type PublicRepositoriesInput,
} from "./shared";

export type PublicSummary = {
  campaignStatus: CampaignStatus;
  canSponsor: boolean;
  balanceFen: number;
  totalRaisedFen: number;
  totalExpenseFen: number;
  sponsorCount: number;
};

export async function getSummary(options?: {
  repositories?: PublicRepositoriesInput;
}): Promise<PublicSummary> {
  const { campaignState, expenses, pledges } = resolvePublicRepositories(
    options?.repositories,
  );
  const currentCampaignState = await campaignState.findCurrent();
  const expenseRecords = await expenses.listPublic();
  const pledgeMetrics = await pledges.summarizePublicMetrics();
  const totalExpenseFen = expenseRecords.reduce(
    (total, expense) => total + expense.amountFen,
    0,
  );
  const campaignStatus = currentCampaignState?.status ?? "ACTIVE";

  return {
    campaignStatus,
    canSponsor: campaignStatus === "ACTIVE",
    balanceFen: pledgeMetrics.totalNetFen - totalExpenseFen,
    totalRaisedFen: pledgeMetrics.totalRaisedFen,
    totalExpenseFen,
    sponsorCount: pledgeMetrics.sponsorCount,
  };
}
