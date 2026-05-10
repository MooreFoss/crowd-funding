import { randomUUID } from "node:crypto";

import type {
  AddExpenseEvidenceInput,
  CreateExpenseInput,
  ExpenseDetailRecord,
  ExpenseEvidenceRecord,
  ExpenseRecord,
  ExpenseRepository,
  ExpenseDetailVisibility,
  ExpenseEvidenceVisibility,
  UpdateExpenseEvidenceInput,
  UpdateExpenseInput,
} from "@/src/domain/expenses";

import type { RepositoryExecutor } from "./shared";
import { parseDate, parseOptionalDate, requireRow } from "./shared";

type ExpenseRow = {
  id: string;
  title: string;
  amount_fen: number;
  description: string;
  detail_visibility: ExpenseDetailVisibility;
  created_by: string;
  voided_at: Date | string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ExpenseEvidenceRow = {
  id: string;
  expense_id: string;
  asset_url: string;
  file_name: string;
  label: string | null;
  sort_order: number;
  visibility: ExpenseEvidenceVisibility;
  uploaded_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    title: row.title,
    amountFen: row.amount_fen,
    description: row.description,
    detailVisibility: row.detail_visibility,
    createdBy: row.created_by,
    voidedAt: parseOptionalDate(row.voided_at),
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

function mapExpenseEvidenceRow(row: ExpenseEvidenceRow): ExpenseEvidenceRecord {
  return {
    id: row.id,
    expenseId: row.expense_id,
    assetUrl: row.asset_url,
    fileName: row.file_name,
    label: row.label,
    sortOrder: row.sort_order,
    visibility: row.visibility,
    uploadedBy: row.uploaded_by,
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

export function createExpenseRepository(
  executor: RepositoryExecutor,
  idFactory: () => string = randomUUID,
): ExpenseRepository {
  return {
    async create(input: CreateExpenseInput) {
      const now = new Date();
      const { rows } = await executor.query<ExpenseRow>(
        `INSERT INTO expenses (
          id,
          title,
          amount_fen,
          description,
          detail_visibility,
          created_by,
          voided_at,
          voided_by,
          void_reason,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, NULL, NULL, NULL, $7, $7
        )
        RETURNING *`,
        [
          idFactory(),
          input.title,
          input.amountFen,
          input.description,
          input.detailVisibility,
          input.createdBy,
          now,
        ],
      );

      return mapExpenseRow(rows[0]);
    },

    async update(input: UpdateExpenseInput) {
      const { rows } = await executor.query<ExpenseRow>(
        `UPDATE expenses
         SET title = $2,
             amount_fen = $3,
             description = $4,
             detail_visibility = $5,
             voided_at = $6,
             voided_by = $7,
             void_reason = $8,
             updated_at = $9
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          input.title,
          input.amountFen,
          input.description,
          input.detailVisibility,
          input.voidedAt ?? null,
          input.voidedBy ?? null,
          input.voidReason ?? null,
          new Date(),
        ],
      );

      return mapExpenseRow(
        requireRow(rows[0], `Expense ${input.id} was not found.`),
      );
    },

    async findById(id: string) {
      const { rows } = await executor.query<ExpenseRow>(
        "SELECT * FROM expenses WHERE id = $1",
        [id],
      );

      return rows[0] ? mapExpenseRow(rows[0]) : null;
    },

    async listPublic() {
      const { rows } = await executor.query<ExpenseRow>(
        `SELECT *
         FROM expenses
         WHERE voided_at IS NULL
         ORDER BY created_at DESC`,
      );

      return rows.map(mapExpenseRow);
    },

    async listAdmin() {
      const { rows } = await executor.query<ExpenseRow>(
        `SELECT *
         FROM expenses
         ORDER BY created_at DESC`,
      );

      return rows.map(mapExpenseRow);
    },

    async addEvidence(input: AddExpenseEvidenceInput) {
      const now = new Date();
      const { rows } = await executor.query<ExpenseEvidenceRow>(
        `INSERT INTO expense_evidence (
          id,
          expense_id,
          asset_url,
          file_name,
          label,
          sort_order,
          visibility,
          uploaded_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
        )
        RETURNING *`,
        [
          idFactory(),
          input.expenseId,
          input.assetUrl,
          input.fileName,
          input.label ?? null,
          input.sortOrder,
          input.visibility,
          input.uploadedBy,
          now,
        ],
      );

      return mapExpenseEvidenceRow(rows[0]);
    },

    async updateEvidence(input: UpdateExpenseEvidenceInput) {
      const { rows } = await executor.query<ExpenseEvidenceRow>(
        `UPDATE expense_evidence
         SET asset_url = COALESCE($2, asset_url),
             file_name = COALESCE($3, file_name),
             label = $4,
             sort_order = $5,
             visibility = $6,
             updated_at = $7
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          input.assetUrl ?? null,
          input.fileName ?? null,
          input.label ?? null,
          input.sortOrder,
          input.visibility,
          new Date(),
        ],
      );

      return mapExpenseEvidenceRow(
        requireRow(rows[0], `Expense evidence ${input.id} was not found.`),
      );
    },

    async listEvidence(expenseId: string) {
      const { rows } = await executor.query<ExpenseEvidenceRow>(
        `SELECT *
         FROM expense_evidence
         WHERE expense_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [expenseId],
      );

      return rows.map(mapExpenseEvidenceRow);
    },

    async getDetail(id: string) {
      const expense = await this.findById(id);

      if (!expense) {
        return null;
      }

      const evidence = await this.listEvidence(id);
      const publicEvidence =
        expense.detailVisibility === "PUBLIC"
          ? evidence.filter((entry) => entry.visibility === "PUBLIC")
          : [];

      return {
        ...expense,
        evidence,
        publicEvidence,
      } satisfies ExpenseDetailRecord;
    },

    async getPublicDetail(id: string) {
      const detail = await this.getDetail(id);

      if (!detail) {
        return null;
      }

      return {
        ...detail,
        evidence: detail.publicEvidence,
      } satisfies ExpenseDetailRecord;
    },
  };
}
