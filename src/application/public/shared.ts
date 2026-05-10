import type { ExpenseRepository } from "@/src/domain/expenses";
import type { CampaignStateRepository } from "@/src/domain/funding";
import type { PledgeRepository } from "@/src/domain/pledges";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import {
  createCampaignStateRepository,
  createExpenseRepository,
  createPledgeRepository,
} from "@/src/infrastructure/persistence/repositories";

export type PublicReadRepositories = {
  campaignState: CampaignStateRepository;
  expenses: ExpenseRepository;
  pledges: PledgeRepository;
};

export type PublicRepositoriesInput = Partial<PublicReadRepositories> & {
  executor?: DatabaseExecutor;
};

export type PublicPageRequest = {
  limit?: number;
  offset?: number;
};

export type PublicPage = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type PublicListResult<Item> = {
  items: Item[];
  page: PublicPage;
};

export function resolvePublicRepositories(
  input?: PublicRepositoriesInput,
): PublicReadRepositories {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return {
    campaignState:
      input?.campaignState ?? createCampaignStateRepository(executor),
    expenses: input?.expenses ?? createExpenseRepository(executor),
    pledges: input?.pledges ?? createPledgeRepository(executor),
  };
}

export function resolvePageRequest(request?: PublicPageRequest) {
  return {
    limit: request?.limit ?? 20,
    offset: request?.offset ?? 0,
  };
}

export function buildPagedResult<Item>(
  items: Item[],
  limit: number,
  offset: number,
): PublicListResult<Item> {
  const hasMore = items.length > limit;

  return {
    items: hasMore ? items.slice(0, limit) : items,
    page: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  };
}

export function toIsoTimestamp(value: Date | null) {
  return value ? value.toISOString() : null;
}
