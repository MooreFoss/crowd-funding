import type { ExpenseEvidenceVisibility } from "@/src/domain/expenses";

import {
  resolvePublicRepositories,
  type PublicRepositoriesInput,
} from "./shared";

export type PublicExpenseDetailEvidence = {
  id: string;
  assetUrl: string;
  fileName: string;
  label: string | null;
  sortOrder: number;
  visibility: ExpenseEvidenceVisibility;
};

export type PublicExpenseDetail = {
  id: string;
  title: string;
  description: string;
  amountFen: number;
  detailVisibility: "PUBLIC" | "AUDIT_ONLY";
  createdAt: string;
  evidence: PublicExpenseDetailEvidence[];
};

export async function getExpenseDetail(
  expenseId: string,
  repositories?: PublicRepositoriesInput,
): Promise<PublicExpenseDetail | null> {
  const { expenses } = resolvePublicRepositories(repositories);
  const detail = await expenses.getPublicDetail(expenseId);

  if (!detail) {
    return null;
  }

  return {
    id: detail.id,
    title: detail.title,
    description: detail.description,
    amountFen: detail.amountFen,
    detailVisibility: detail.detailVisibility,
    createdAt: detail.createdAt.toISOString(),
    evidence: detail.evidence.map((evidence) => ({
      id: evidence.id,
      assetUrl: evidence.assetUrl,
      fileName: evidence.fileName,
      label: evidence.label,
      sortOrder: evidence.sortOrder,
      visibility: evidence.visibility,
    })),
  };
}
