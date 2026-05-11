import type {
  SystemSettingKey,
  SystemSettingRecord,
  SystemSettingsRepository,
  UpsertSystemSettingInput,
} from "@/src/domain/settings";

import type { RepositoryExecutor } from "./shared";
import { parseDate } from "./shared";

type SystemSettingRow = {
  key: SystemSettingKey;
  value: string;
  updated_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapSystemSettingRow(row: SystemSettingRow): SystemSettingRecord {
  return {
    key: row.key,
    value: row.value,
    updatedBy: row.updated_by,
    createdAt: parseDate(row.created_at),
    updatedAt: parseDate(row.updated_at),
  };
}

export function createSystemSettingsRepository(
  executor: RepositoryExecutor,
): SystemSettingsRepository {
  return {
    async getMany(keys: SystemSettingKey[]) {
      if (keys.length === 0) {
        return {};
      }

      const { rows } = await executor.query<SystemSettingRow>(
        `SELECT *
         FROM system_settings
         WHERE key = ANY($1::text[])`,
        [keys],
      );

      return rows.reduce<Partial<Record<SystemSettingKey, string>>>(
        (settings, row) => ({
          ...settings,
          [row.key]: row.value,
        }),
        {},
      );
    },

    async listAll() {
      const { rows } = await executor.query<SystemSettingRow>(
        `SELECT *
         FROM system_settings
         ORDER BY key ASC`,
      );

      return rows.map(mapSystemSettingRow);
    },

    async upsertMany(input: UpsertSystemSettingInput[]) {
      if (input.length === 0) {
        return [];
      }

      const now = new Date();
      const rows = await Promise.all(
        input.map(async (setting) => {
          const result = await executor.query<SystemSettingRow>(
            `INSERT INTO system_settings (
              key,
              value,
              updated_by,
              created_at,
              updated_at
            ) VALUES (
              $1, $2, $3, $4, $4
            )
            ON CONFLICT (key)
            DO UPDATE SET
              value = EXCLUDED.value,
              updated_by = EXCLUDED.updated_by,
              updated_at = EXCLUDED.updated_at
            RETURNING *`,
            [setting.key, setting.value, setting.updatedBy, now],
          );

          return mapSystemSettingRow(result.rows[0]);
        }),
      );

      return rows;
    },
  };
}
