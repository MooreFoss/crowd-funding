import { randomUUID } from "node:crypto";

import type {
  CreateTermsVersionInput,
  PublishTermsVersionInput,
  TermsRepository,
  TermsStatus,
  TermsVersionRecord,
} from "@/src/domain/terms";

import type { RepositoryExecutor } from "./shared";
import { parseDate, parseOptionalDate, requireRow } from "./shared";

type TermsRow = {
  id: string;
  version: string;
  title: string;
  body: string;
  status: TermsStatus;
  published_at: Date | string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapTermsRow(row: TermsRow): TermsVersionRecord {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    body: row.body,
    status: row.status,
    publishedAt: parseOptionalDate(row.published_at),
    createdBy: row.created_by,
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

export function createTermsRepository(
  executor: RepositoryExecutor,
  idFactory: () => string = randomUUID,
): TermsRepository {
  return {
    async create(input: CreateTermsVersionInput) {
      const now = new Date();
      const { rows } = await executor.query<TermsRow>(
        `INSERT INTO terms_versions (
          id,
          version,
          title,
          body,
          status,
          published_at,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $8
        )
        RETURNING *`,
        [
          idFactory(),
          input.version,
          input.title,
          input.body,
          input.status,
          input.status === "ACTIVE" ? now : null,
          input.createdBy,
          now,
        ],
      );

      return mapTermsRow(rows[0]);
    },

    async findById(id: string) {
      const { rows } = await executor.query<TermsRow>(
        "SELECT * FROM terms_versions WHERE id = $1",
        [id],
      );

      return rows[0] ? mapTermsRow(rows[0]) : null;
    },

    async findActive() {
      const { rows } = await executor.query<TermsRow>(
        `SELECT *
         FROM terms_versions
         WHERE status = 'ACTIVE'
         ORDER BY published_at DESC NULLS LAST, updated_at DESC
         LIMIT 1`,
      );

      return rows[0] ? mapTermsRow(rows[0]) : null;
    },

    async listAll() {
      const { rows } = await executor.query<TermsRow>(
        `SELECT *
         FROM terms_versions
         ORDER BY created_at DESC`,
      );

      return rows.map(mapTermsRow);
    },

    async publish(input: PublishTermsVersionInput) {
      const { rows } = await executor.query<TermsRow>(
        `WITH target AS (
           SELECT id
           FROM terms_versions
           WHERE id = $1
         ),
         retire_existing AS (
           UPDATE terms_versions
           SET status = 'RETIRED',
               updated_at = $2
           WHERE status = 'ACTIVE'
             AND id <> $1
             AND EXISTS (SELECT 1 FROM target)
         ),
         activate_target AS (
           UPDATE terms_versions
           SET status = 'ACTIVE',
               published_at = $2,
               updated_at = $2
           WHERE id = $1
             AND EXISTS (SELECT 1 FROM target)
           RETURNING *
         )
         SELECT *
         FROM activate_target`,
        [input.id, input.publishedAt],
      );

      return mapTermsRow(
        requireRow(rows[0], `Terms version ${input.id} was not found.`),
      );
    },
  };
}
