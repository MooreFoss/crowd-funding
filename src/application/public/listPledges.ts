import { getStatusLabel } from "@/src/shared";

import {
  buildPagedResult,
  resolvePageRequest,
  resolvePublicRepositories,
  toIsoTimestamp,
  type PublicListResult,
  type PublicPageRequest,
  type PublicRepositoriesInput,
} from "./shared";

export type PublicPledgeListItem = {
  id: string;
  displayName: string;
  message: string | null;
  amountFen: number;
  status: string;
  statusLabel: string;
  paidAt: string | null;
  createdAt: string;
};

export async function listPledges(
  request?: PublicPageRequest,
  repositories?: PublicRepositoriesInput,
): Promise<PublicListResult<PublicPledgeListItem>> {
  const { pledges } = resolvePublicRepositories(repositories);
  const { limit, offset } = resolvePageRequest(request);
  const records = await pledges.listPublic({
    limit: limit + 1,
    offset,
  });
  const page = buildPagedResult(records, limit, offset);

  return {
    items: page.items.map((record) => ({
      id: record.id,
      displayName: record.publicName?.trim() || "匿名用户",
      message: record.publicMessage?.trim() || null,
      amountFen: record.netAmountFen,
      status: record.status,
      statusLabel: getStatusLabel(record.status),
      paidAt: toIsoTimestamp(record.paidAt),
      createdAt: record.createdAt.toISOString(),
    })),
    page: page.page,
  };
}
