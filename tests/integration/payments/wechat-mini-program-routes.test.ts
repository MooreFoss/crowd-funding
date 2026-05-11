import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import { POST as postWechatLogin } from "@/app/api/wechat/login/route";
import { POST as postWechatSponsorOrder } from "@/app/api/wechat/sponsorship/orders/route";
import { createTermsRepository } from "@/src/infrastructure/persistence/repositories";

const migrationsDirectory = fileURLToPath(
  new URL("../../../src/infrastructure/persistence/migrations", import.meta.url),
);

type TestContext = Awaited<ReturnType<typeof createTestContext>>;

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
  const schemaName = `cf_wechat_routes_${randomUUID().replaceAll("-", "")}`;
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

function createJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

describe("wechat mini program routes", () => {
  let context: TestContext;
  let originalDatabaseUrl: string | undefined;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalFetch = globalThis.fetch;
    context = await createTestContext();
    process.env.DATABASE_URL = withSchemaSearchPath(
      originalDatabaseUrl ?? "",
      context.schemaName,
    );
    globalThis.crowdFundingDatabasePool = undefined;

    const draftTerms = await context.terms.create({
      version: "v1.0.0",
      title: "Crowdfunding Terms",
      body: "Terms body",
      status: "DRAFT",
      createdBy: "admin",
    });
    await context.terms.publish({
      id: draftTerms.id,
      publishedAt: new Date("2026-05-10T10:00:00.000Z"),
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (globalThis.crowdFundingDatabasePool) {
      await globalThis.crowdFundingDatabasePool.end();
      globalThis.crowdFundingDatabasePool = undefined;
    }

    await destroyTestContext(context);
  });

  it("exchanges wx.login code without exposing openid or secrets to logs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.pathname).toBe("/sns/jscode2session");
      expect(url.searchParams.get("appid")).toBe("wx-test-app");
      expect(url.searchParams.get("secret")).toBe("test-mini-program-app-secret");
      expect(url.searchParams.get("js_code")).toBe("login-code-1001");
      expect(url.searchParams.get("grant_type")).toBe("authorization_code");

      return new Response(
        JSON.stringify({
          openid: "openid-1001",
          unionid: "unionid-1001",
          session_key: "session-key-should-not-leak",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await postWechatLogin(
      createJsonRequest("http://localhost/api/wechat/login", {
        code: "login-code-1001",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      unionid: "unionid-1001",
    });
  });

  it("creates JSAPI sponsor orders and never returns openid or secret material", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/sns/jscode2session") {
        return new Response(JSON.stringify({ openid: "openid-2001" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      if (url.pathname === "/v3/pay/transactions/jsapi") {
        const body = JSON.parse(String(init?.body)) as {
          payer: { openid?: string };
          amount: { total?: number };
          out_trade_no?: string;
        };

        expect(body.payer.openid).toBe("openid-2001");
        expect(body.amount.total).toBe(1000);
        expect(body.out_trade_no).toBeTruthy();

        return new Response(JSON.stringify({ prepay_id: "prepay-route-2001" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      if (url.hostname === "tms.tencentcloudapi.com") {
        const tmsRequest = JSON.parse(String(init?.body ?? "{}")) as {
          DataId?: string;
        };

        return new Response(
          JSON.stringify({
            Response: {
              RequestId: `tms-route-${tmsRequest.DataId ?? "2001"}`,
              Suggestion: "Pass",
              Label: "Normal",
              Keywords: [],
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await postWechatSponsorOrder(
      createJsonRequest("http://localhost/api/wechat/sponsorship/orders", {
        code: "login-code-2001",
        amount: "10.00",
        displayName: "小程序用户",
        message: "来自小程序",
        termsAccepted: true,
      }),
    );
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      mode: "MINI_PROGRAM_JSAPI",
      amountFen: 1000,
      status: "PAYING",
      payment: {
        package: "prepay_id=prepay-route-2001",
        signType: "RSA",
      },
    });
    expect(body.merchantOrderNo).toBeTruthy();
    expect(bodyText).not.toContain("openid-2001");
    expect(bodyText).not.toContain("session-key");
    expect(bodyText).not.toContain("test-mini-program-app-secret");
  });

  it("rejects code exchange failures before creating a pledge", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          errcode: 40029,
          errmsg: "invalid code",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }) as typeof fetch;

    const response = await postWechatSponsorOrder(
      createJsonRequest("http://localhost/api/wechat/sponsorship/orders", {
        code: "bad-code",
        amount: "10.00",
        displayName: "小程序用户",
        message: "来自小程序",
        termsAccepted: true,
      }),
    );
    const countResult = await context.client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM pledges",
    );

    expect(response.status).toBe(400);
    expect(countResult.rows[0]?.count).toBe(0);
  });
});

