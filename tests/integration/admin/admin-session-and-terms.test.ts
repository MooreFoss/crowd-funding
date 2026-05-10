import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  createPledgeRepository,
  createTermsRepository,
} from "@/src/infrastructure/persistence/repositories";

import { DELETE as deleteAdminSession, GET as getAdminSession, POST as postAdminSession } from "@/app/api/admin/session/route";
import { GET as getAdminTerms, PATCH as patchAdminTerms, POST as postAdminTerms } from "@/app/api/admin/terms/route";
import { GET as getActiveTerms } from "@/app/api/public/terms/active/route";

const migrationsDirectory = fileURLToPath(
  new URL("../../../src/infrastructure/persistence/migrations", import.meta.url),
);

type TestContext = Awaited<ReturnType<typeof createTestContext>>;

type CookieSessionPayload = {
  cookie: string;
  username: string;
};

async function applyMigrations(queryable: { query(text: string): Promise<unknown> }) {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(join(migrationsDirectory, migrationFile), "utf8");
    await queryable.query(sql);
  }
}

async function createTestContext() {
  const schemaName = `cf_admin_${randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);
  await applyMigrations(client);

  return {
    schemaName,
    pool,
    client,
    pledges: createPledgeRepository(client),
    terms: createTermsRepository(client),
  };
}

async function destroyTestContext(context: TestContext) {
  try {
    await context.client.query('SET search_path TO "public"');
    await context.client.query(`DROP SCHEMA IF EXISTS "${context.schemaName}" CASCADE`);
  } finally {
    context.client.release();
    await context.pool.end();
  }
}

function withSchemaSearchPath(databaseUrl: string, schema: string) {
  const connection = new URL(databaseUrl);
  connection.searchParams.set("options", `-c search_path=${schema},public`);
  return connection.toString();
}

function createJsonRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
  } = {},
) {
  return new Request(url, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function readSessionCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Expected a session cookie to be set.");
  }

  return setCookie.split(";")[0];
}

describe("admin-session integration", () => {
  let context: TestContext | undefined;
  let originalAdminUsername: string | undefined;
  let originalAdminPassword: string | undefined;
  let originalSessionSecret: string | undefined;
  let originalDatabaseUrl: string | undefined;

  beforeEach(async () => {
    originalAdminUsername = process.env.ADMIN_USERNAME;
    originalAdminPassword = process.env.ADMIN_PASSWORD;
    originalSessionSecret = process.env.SESSION_SECRET;
    originalDatabaseUrl = process.env.DATABASE_URL;

    context = await createTestContext();

    process.env.ADMIN_USERNAME = "test-admin";
    process.env.ADMIN_PASSWORD = "swordfish";
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.DATABASE_URL = withSchemaSearchPath(
      originalDatabaseUrl ?? "",
      context.schemaName,
    );
    globalThis.crowdFundingDatabasePool = undefined;
  });

  afterEach(async () => {
    if (originalAdminUsername === undefined) {
      delete process.env.ADMIN_USERNAME;
    } else {
      process.env.ADMIN_USERNAME = originalAdminUsername;
    }

    if (originalAdminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = originalAdminPassword;
    }

    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (globalThis.crowdFundingDatabasePool) {
      await globalThis.crowdFundingDatabasePool.end();
      globalThis.crowdFundingDatabasePool = undefined;
    }

    if (context) {
      await destroyTestContext(context);
      context = undefined;
    }
  });

  async function login(): Promise<CookieSessionPayload> {
    const response = await postAdminSession(
      createJsonRequest("http://localhost/api/admin/session", {
        method: "POST",
        body: {
          username: "test-admin",
          password: "swordfish",
        },
      }),
    );

    expect(response.status).toBe(200);

    return {
      cookie: readSessionCookie(response),
      username: "test-admin",
    };
  }

  it("supports admin-session login, rejects invalid credentials, and blocks protected terms routes", async () => {
    const anonymousLookup = await getAdminSession(
      createJsonRequest("http://localhost/api/admin/session"),
    );
    expect(await anonymousLookup.json()).toEqual({
      authenticated: false,
      username: null,
    });

    const invalidLogin = await postAdminSession(
      createJsonRequest("http://localhost/api/admin/session", {
        method: "POST",
        body: {
          username: "test-admin",
          password: "wrong-password",
        },
      }),
    );
    expect(invalidLogin.status).toBe(401);

    const unauthorizedTerms = await getAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms"),
    );
    expect(unauthorizedTerms.status).toBe(401);

    const session = await login();

    const authenticatedLookup = await getAdminSession(
      createJsonRequest("http://localhost/api/admin/session", {
        cookie: session.cookie,
      }),
    );
    expect(await authenticatedLookup.json()).toEqual({
      authenticated: true,
      username: session.username,
    });

    const authorizedTerms = await getAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms", {
        cookie: session.cookie,
      }),
    );
    expect(authorizedTerms.status).toBe(200);
    expect(await authorizedTerms.json()).toEqual({
      activeVersionId: null,
      items: [],
    });

    const logout = await deleteAdminSession(
      createJsonRequest("http://localhost/api/admin/session", {
        method: "DELETE",
        cookie: session.cookie,
      }),
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("creates draft terms, publishes exactly one active version, and keeps older bindings intact", async () => {
    const session = await login();

    const firstDraftResponse = await postAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms", {
        method: "POST",
        cookie: session.cookie,
        body: {
          version: "v1.0.0",
          title: "Terms v1",
          body: "Version one body",
        },
      }),
    );
    expect(firstDraftResponse.status).toBe(201);
    const firstDraft = await firstDraftResponse.json();
    expect(firstDraft.status).toBe("DRAFT");

    const firstPublishResponse = await patchAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms", {
        method: "PATCH",
        cookie: session.cookie,
        body: {
          id: firstDraft.id,
        },
      }),
    );
    expect(firstPublishResponse.status).toBe(200);
    const firstPublished = await firstPublishResponse.json();
    expect(firstPublished.status).toBe("ACTIVE");

    const pledge = await context.pledges.createPending({
      merchantOrderNo: "ADMIN-TERMS-ORDER-1",
      paymentChannel: "ZPAY_WECHAT_H5",
      userKey: "user-admin-terms",
      submittedName: "Alice",
      publicName: "Alice",
      submittedMessage: "Bound to the first version",
      publicMessage: "Bound to the first version",
      amountFen: 1_000,
      paymentRedirectUrl: null,
      termsVersionId: firstPublished.id,
      termsAcceptedAt: new Date("2026-05-10T09:00:00.000Z"),
    });

    const secondDraftResponse = await postAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms", {
        method: "POST",
        cookie: session.cookie,
        body: {
          version: "v1.1.0",
          title: "Terms v2",
          body: "Version two body",
        },
      }),
    );
    expect(secondDraftResponse.status).toBe(201);
    const secondDraft = await secondDraftResponse.json();

    const secondPublishResponse = await patchAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms", {
        method: "PATCH",
        cookie: session.cookie,
        body: {
          id: secondDraft.id,
        },
      }),
    );
    expect(secondPublishResponse.status).toBe(200);
    const secondPublished = await secondPublishResponse.json();
    expect(secondPublished.status).toBe("ACTIVE");

    const listResponse = await getAdminTerms(
      createJsonRequest("http://localhost/api/admin/terms", {
        cookie: session.cookie,
      }),
    );
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      activeVersionId: secondPublished.id,
      items: [
        expect.objectContaining({
          id: secondPublished.id,
          version: "v1.1.0",
          status: "ACTIVE",
        }),
        expect.objectContaining({
          id: firstPublished.id,
          version: "v1.0.0",
          status: "RETIRED",
        }),
      ],
    });

    const publicActiveResponse = await getActiveTerms(
      createJsonRequest("http://localhost/api/public/terms/active"),
    );
    expect(publicActiveResponse.status).toBe(200);
    expect(await publicActiveResponse.json()).toMatchObject({
      id: secondPublished.id,
      version: "v1.1.0",
      title: "Terms v2",
      body: "Version two body",
      status: "ACTIVE",
    });

    const boundPledge = await context.pledges.findById(pledge.id);
    const historicalFirstVersion = await context.terms.findById(firstPublished.id);

    expect(boundPledge?.termsVersionId).toBe(firstPublished.id);
    expect(historicalFirstVersion).toMatchObject({
      id: firstPublished.id,
      version: "v1.0.0",
      title: "Terms v1",
      body: "Version one body",
      status: "RETIRED",
    });
  });
});
