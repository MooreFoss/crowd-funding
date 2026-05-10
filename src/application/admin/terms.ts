import type { AuditLogRepository } from "@/src/domain/audit";
import type { TermsRepository, TermsVersionRecord } from "@/src/domain/terms";
import { logAuditEvent } from "@/src/infrastructure/audit";
import type { DatabaseExecutor } from "@/src/infrastructure/persistence/client";
import {
  queryDatabase,
  withDatabaseClient,
} from "@/src/infrastructure/persistence/client";
import { createTermsRepository } from "@/src/infrastructure/persistence/repositories";

type TermsRepositoriesInput = {
  auditLogs?: AuditLogRepository;
  executor?: DatabaseExecutor;
  terms?: TermsRepository;
};

export type AdminTermsVersion = {
  id: string;
  version: string;
  title: string;
  body: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminTermsList = {
  activeVersionId: string | null;
  items: AdminTermsVersion[];
};

export type CreateDraftTermsVersionInput = {
  version: string;
  title: string;
  body: string;
  createdBy: string;
};

function mapTermsVersion(record: TermsVersionRecord): AdminTermsVersion {
  return {
    id: record.id,
    version: record.version,
    title: record.title,
    body: record.body,
    status: record.status,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function resolveTermsRepository(input?: TermsRepositoriesInput) {
  if (input?.terms) {
    return input.terms;
  }

  const executor: DatabaseExecutor = input?.executor ?? {
    query: queryDatabase,
  };

  return createTermsRepository(executor);
}

export async function listTermsVersions(repositories?: TermsRepositoriesInput) {
  const terms = resolveTermsRepository(repositories);
  const items = await terms.listAll();
  const active = items.find((item) => item.status === "ACTIVE") ?? null;

  return {
    activeVersionId: active?.id ?? null,
    items: items.map(mapTermsVersion),
  } satisfies AdminTermsList;
}

export async function createDraftTermsVersion(
  input: CreateDraftTermsVersionInput,
  repositories?: TermsRepositoriesInput,
) {
  const terms = resolveTermsRepository(repositories);
  const created = await terms.create({
    version: input.version,
    title: input.title,
    body: input.body,
    status: "DRAFT",
    createdBy: input.createdBy,
  });

  return mapTermsVersion(created);
}

export async function publishTermsVersion(
  input: {
    id: string;
    publishedAt?: Date;
  },
  repositories?: TermsRepositoriesInput,
) {
  const publishAt = input.publishedAt ?? new Date();

  const published =
    repositories?.terms || repositories?.executor
      ? await resolveTermsRepository(repositories).publish({
          id: input.id,
          publishedAt: publishAt,
        })
      : await withDatabaseClient(async (client) =>
          createTermsRepository(client).publish({
            id: input.id,
            publishedAt: publishAt,
          }),
        );

  if (!repositories || repositories.auditLogs) {
    await logAuditEvent(
      {
        actorType: "ADMIN",
        actorId: "admin",
        action: "TERMS_PUBLISHED",
        targetType: "TERMS_VERSION",
        targetId: published.id,
        afterSummary: {
          version: published.version,
          status: published.status,
        },
      },
      repositories?.auditLogs ? { auditLogs: repositories.auditLogs } : undefined,
    );
  }

  return mapTermsVersion(published);
}

export async function getActiveTermsVersion(
  repositories?: TermsRepositoriesInput,
) {
  const terms = resolveTermsRepository(repositories);
  const active = await terms.findActive();

  return active ? mapTermsVersion(active) : null;
}
