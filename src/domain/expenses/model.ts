export type ExpenseDetailVisibility = "PUBLIC" | "AUDIT_ONLY";
export type ExpenseEvidenceVisibility = "PUBLIC" | "AUDIT_ONLY";

export type ExpenseRecord = {
  id: string;
  title: string;
  amountFen: number;
  description: string;
  detailVisibility: ExpenseDetailVisibility;
  createdBy: string;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpenseEvidenceRecord = {
  id: string;
  expenseId: string;
  assetUrl: string;
  fileName: string;
  label: string | null;
  sortOrder: number;
  visibility: ExpenseEvidenceVisibility;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpenseDetailRecord = ExpenseRecord & {
  evidence: ExpenseEvidenceRecord[];
  publicEvidence: ExpenseEvidenceRecord[];
};

export type CreateExpenseInput = {
  title: string;
  amountFen: number;
  description: string;
  detailVisibility: ExpenseDetailVisibility;
  createdBy: string;
};

export type UpdateExpenseInput = {
  id: string;
  title: string;
  amountFen: number;
  description: string;
  detailVisibility: ExpenseDetailVisibility;
  voidedAt?: Date | null;
  voidedBy?: string | null;
  voidReason?: string | null;
};

export type AddExpenseEvidenceInput = {
  expenseId: string;
  assetUrl: string;
  fileName: string;
  label?: string | null;
  sortOrder: number;
  visibility: ExpenseEvidenceVisibility;
  uploadedBy: string;
};

export interface ExpenseRepository {
  create(input: CreateExpenseInput): Promise<ExpenseRecord>;
  update(input: UpdateExpenseInput): Promise<ExpenseRecord>;
  findById(id: string): Promise<ExpenseRecord | null>;
  listPublic(): Promise<ExpenseRecord[]>;
  listAdmin(): Promise<ExpenseRecord[]>;
  addEvidence(input: AddExpenseEvidenceInput): Promise<ExpenseEvidenceRecord>;
  listEvidence(expenseId: string): Promise<ExpenseEvidenceRecord[]>;
  getDetail(id: string): Promise<ExpenseDetailRecord | null>;
  getPublicDetail(id: string): Promise<ExpenseDetailRecord | null>;
}
