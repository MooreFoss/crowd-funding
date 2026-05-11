import type { SystemSettingsRepository } from "@/src/domain/settings";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import { queryDatabase } from "@/src/infrastructure/persistence/client";
import { createSystemSettingsRepository } from "@/src/infrastructure/persistence/repositories";

type SettingsRepositoriesInput = {
  executor?: DatabaseExecutor;
  settings?: SystemSettingsRepository;
};

export type EditableSiteSettings = {
  siteTitle: string;
  faviconUrl: string;
  heroTitle: string;
  heroDescription: string;
};

export const DEFAULT_EDITABLE_SITE_SETTINGS: EditableSiteSettings = {
  siteTitle: "众筹系统 - 透明可追溯的资金管理平台",
  faviconUrl: "/favicon.ico",
  heroTitle: "资金池总览",
  heroDescription: "当前众筹正常进行中，公开数据将随支付与支出实时更新。",
};

function resolveSettingsRepository(input?: SettingsRepositoriesInput) {
  if (input?.settings) {
    return input.settings;
  }

  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return createSystemSettingsRepository(executor);
}

function normalizePathOrUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return DEFAULT_EDITABLE_SITE_SETTINGS.faviconUrl;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const url = new URL(trimmed);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Favicon URL must use http, https, or an absolute path.");
  }

  return url.toString();
}

function normalizeSettings(input: EditableSiteSettings): EditableSiteSettings {
  const siteTitle = input.siteTitle.trim();
  const heroTitle = input.heroTitle.trim();
  const heroDescription = input.heroDescription.trim();

  if (!siteTitle) {
    throw new Error("Site title is required.");
  }

  if (!heroTitle) {
    throw new Error("Hero title is required.");
  }

  if (!heroDescription) {
    throw new Error("Hero description is required.");
  }

  return {
    siteTitle,
    faviconUrl: normalizePathOrUrl(input.faviconUrl),
    heroTitle,
    heroDescription,
  };
}

export async function getEditableSiteSettings(
  repositories?: SettingsRepositoriesInput,
): Promise<EditableSiteSettings> {
  const settings = resolveSettingsRepository(repositories);
  const stored = await settings.getMany([
    "site_title",
    "favicon_url",
    "hero_title",
    "hero_description",
  ]);

  return {
    siteTitle: stored.site_title ?? DEFAULT_EDITABLE_SITE_SETTINGS.siteTitle,
    faviconUrl: stored.favicon_url ?? DEFAULT_EDITABLE_SITE_SETTINGS.faviconUrl,
    heroTitle: stored.hero_title ?? DEFAULT_EDITABLE_SITE_SETTINGS.heroTitle,
    heroDescription:
      stored.hero_description ?? DEFAULT_EDITABLE_SITE_SETTINGS.heroDescription,
  };
}

export async function updateEditableSiteSettings(
  input: EditableSiteSettings & {
    updatedBy: string;
  },
  repositories?: SettingsRepositoriesInput,
) {
  const settings = resolveSettingsRepository(repositories);
  const normalized = normalizeSettings(input);

  await settings.upsertMany([
    {
      key: "site_title",
      value: normalized.siteTitle,
      updatedBy: input.updatedBy,
    },
    {
      key: "favicon_url",
      value: normalized.faviconUrl,
      updatedBy: input.updatedBy,
    },
    {
      key: "hero_title",
      value: normalized.heroTitle,
      updatedBy: input.updatedBy,
    },
    {
      key: "hero_description",
      value: normalized.heroDescription,
      updatedBy: input.updatedBy,
    },
  ]);

  return getEditableSiteSettings({ settings });
}
