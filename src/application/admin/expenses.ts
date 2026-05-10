import type {
  ExpenseDetailRecord,
  ExpenseEvidenceRecord,
  ExpenseEvidenceVisibility,
  ExpenseRepository,
} from "@/src/domain/expenses";
import type { EvidenceUploadTargetInput } from "@/src/infrastructure/storage";
import { createConfiguredCosEvidenceStorage } from "@/src/infrastructure/storage";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import { createExpenseRepository } from "@/src/infrastructure/persistence/repositories";
import { parseMoneyToFen } from "@/src/shared";

type AdminExpenseRepositoriesInput = {
  executor?: DatabaseExecutor;
  expenses?: ExpenseRepository;
};

export type AdminExpenseEvidenceInput = {
  assetUrl: string;
  fileName: string;
  label?: string | null;
  sortOrder?: number;
  visibility?: ExpenseEvidenceVisibility;
};

export type AdminExpenseInput = {
  title: string;
  amount: string;
  description: string;
  detailVisibility: "PUBLIC" | "AUDIT_ONLY";
  evidence?: AdminExpenseEvidenceInput[];
};

function resolveAdminExpenseRepository(input?: AdminExpenseRepositoriesInput) {
  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return input?.expenses ?? createExpenseRepository(executor);
}

function normalizeExpenseInput(input: AdminExpenseInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const amountFen = parseMoneyToFen(input.amount);

  if (!title) {
    throw new Error("Expense title is required.");
  }

  if (amountFen <= 0) {
    throw new Error("Expense amount must be greater than zero.");
  }

  return {
    title,
    description,
    amountFen,
    detailVisibility: input.detailVisibility,
  };
}

function normalizeEvidenceInput(
  evidence: AdminExpenseEvidenceInput,
  fallbackSortOrder: number,
) {
  const assetUrl = evidence.assetUrl.trim();
  const fileName = evidence.fileName.trim();

  if (!assetUrl || !fileName) {
    throw new Error("Evidence asset URL and file name are required.");
  }

  return {
    assetUrl,
    fileName,
    label: evidence.label?.trim() || null,
    sortOrder: evidence.sortOrder ?? fallbackSortOrder,
    visibility: evidence.visibility ?? "PUBLIC",
  };
}

function mapEvidence(record: ExpenseEvidenceRecord) {
  return {
    id: record.id,
    expenseId: record.expenseId,
    assetUrl: record.assetUrl,
    fileName: record.fileName,
    label: record.label,
    sortOrder: record.sortOrder,
    visibility: record.visibility,
    uploadedBy: record.uploadedBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapExpenseDetail(record: ExpenseDetailRecord) {
  return {
    id: record.id,
    title: record.title,
    amountFen: record.amountFen,
    description: record.description,
    detailVisibility: record.detailVisibility,
    createdBy: record.createdBy,
    voidedAt: record.voidedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    evidence: record.evidence.map(mapEvidence),
    publicEvidence: record.publicEvidence.map(mapEvidence),
  };
}

export async function listAdminExpenses(
  repositories?: AdminExpenseRepositoriesInput,
) {
  const expenses = resolveAdminExpenseRepository(repositories);
  const records = await expenses.listAdmin();
  const details = await Promise.all(
    records.map(async (record) => expenses.getDetail(record.id)),
  );

  return {
    items: details
      .filter((record): record is ExpenseDetailRecord => record !== null)
      .map(mapExpenseDetail),
  };
}

export async function createAdminExpense(
  input: AdminExpenseInput & {
    createdBy: string;
  },
  repositories?: AdminExpenseRepositoriesInput,
) {
  const expenses = resolveAdminExpenseRepository(repositories);
  const normalized = normalizeExpenseInput(input);
  const created = await expenses.create({
    ...normalized,
    createdBy: input.createdBy,
  });

  for (const [index, evidence] of (input.evidence ?? []).entries()) {
    await expenses.addEvidence({
      expenseId: created.id,
      uploadedBy: input.createdBy,
      ...normalizeEvidenceInput(evidence, index + 1),
    });
  }

  const detail = await expenses.getDetail(created.id);

  if (!detail) {
    throw new Error(`Expense ${created.id} was not found after creation.`);
  }

  return mapExpenseDetail(detail);
}

export async function updateAdminExpense(
  input: AdminExpenseInput & {
    id: string;
  },
  repositories?: AdminExpenseRepositoriesInput,
) {
  const expenses = resolveAdminExpenseRepository(repositories);
  const current = await expenses.findById(input.id);

  if (!current) {
    throw new Error(`Expense ${input.id} was not found.`);
  }

  const normalized = normalizeExpenseInput(input);
  const updated = await expenses.update({
    id: input.id,
    ...normalized,
    voidedAt: current.voidedAt,
    voidedBy: current.voidedBy,
    voidReason: current.voidReason,
  });

  for (const [index, evidence] of (input.evidence ?? []).entries()) {
    await expenses.addEvidence({
      expenseId: updated.id,
      uploadedBy: current.createdBy,
      ...normalizeEvidenceInput(evidence, index + 1),
    });
  }

  const detail = await expenses.getDetail(updated.id);

  if (!detail) {
    throw new Error(`Expense ${updated.id} was not found after update.`);
  }

  return mapExpenseDetail(detail);
}

export async function addAdminExpenseEvidence(
  input: AdminExpenseEvidenceInput & {
    expenseId: string;
    uploadedBy: string;
  },
  repositories?: AdminExpenseRepositoriesInput,
) {
  const expenses = resolveAdminExpenseRepository(repositories);
  const evidence = await expenses.addEvidence({
    expenseId: input.expenseId,
    uploadedBy: input.uploadedBy,
    ...normalizeEvidenceInput(input, input.sortOrder ?? 1),
  });

  return mapEvidence(evidence);
}

export async function updateAdminExpenseEvidence(
  input: {
    id: string;
    assetUrl?: string;
    fileName?: string;
    label?: string | null;
    sortOrder: number;
    visibility: ExpenseEvidenceVisibility;
  },
  repositories?: AdminExpenseRepositoriesInput,
) {
  const expenses = resolveAdminExpenseRepository(repositories);
  const evidence = await expenses.updateEvidence({
    id: input.id,
    assetUrl: input.assetUrl,
    fileName: input.fileName,
    label: input.label?.trim() || null,
    sortOrder: input.sortOrder,
    visibility: input.visibility,
  });

  return mapEvidence(evidence);
}

export function createExpenseEvidenceUploadTarget(
  input: EvidenceUploadTargetInput,
) {
  return createConfiguredCosEvidenceStorage().createUploadTarget(input);
}
