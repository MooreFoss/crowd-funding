import {
  buildPagedResult,
  resolvePageRequest,
  resolvePublicRepositories,
  type PublicListResult,
  type PublicPageRequest,
  type PublicRepositoriesInput,
} from "./shared";

export type PublicExpenseListItem = {
  id: string;
  title: string;
  description: string;
  amountFen: number;
  detailVisibility: "PUBLIC" | "AUDIT_ONLY";
  createdAt: string;
};

export async function listExpenses(
  request?: PublicPageRequest,
  repositories?: PublicRepositoriesInput,
): Promise<PublicListResult<PublicExpenseListItem>> {
  const { expenses } = resolvePublicRepositories(repositories);
  const { limit, offset } = resolvePageRequest(request);
  const records = await expenses.listPublic();
  const page = buildPagedResult(records.slice(offset, offset + limit + 1), limit, offset);

  return {
    items: page.items.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description,
      amountFen: record.amountFen,
      detailVisibility: record.detailVisibility,
      createdAt: record.createdAt.toISOString(),
    })),
    page: page.page,
  };
}
