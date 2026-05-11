export type SystemSettingKey =
  | "site_title"
  | "favicon_url"
  | "hero_title"
  | "hero_description";

export type SystemSettingRecord = {
  key: SystemSettingKey;
  value: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertSystemSettingInput = {
  key: SystemSettingKey;
  value: string;
  updatedBy: string;
};

export interface SystemSettingsRepository {
  getMany(keys: SystemSettingKey[]): Promise<Partial<Record<SystemSettingKey, string>>>;
  listAll(): Promise<SystemSettingRecord[]>;
  upsertMany(input: UpsertSystemSettingInput[]): Promise<SystemSettingRecord[]>;
}
