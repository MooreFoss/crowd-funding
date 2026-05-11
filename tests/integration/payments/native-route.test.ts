import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import { POST as postLegacySponsorOrder } from "@/app/api/sponsorship/orders/route";
import { POST as postNativeSponsorOrder } from "@/app/api/sponsorship/native-orders/route";
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
  const schemaName = `cf_native_route_${randomUUID().replaceAll("-", "")}`;
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

function createJsonRequest(url: string, body: unknown, userAgent = "Mozilla/5.0") {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": userAgent,
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

describe("native sponsorship route", () => {
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

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.hostname === "tms.tencentcloudapi.com") {
        const tmsRequest = JSON.parse(String(init?.body ?? "{}")) as {
          DataId?: string;
        };

        return new Response(
          JSON.stringify({
            Response: {
              RequestId: `tms-native-${tmsRequest.DataId ?? "request"}`,
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

      if (url.pathname === "/v3/pay/transactions/native") {
        const body = JSON.parse(String(init?.body)) as {
          amount: { total?: number };
          out_trade_no?: string;
        };

        expect(body.amount.total).toBe(1234);
        expect(body.out_trade_no).toBeTruthy();

        return new Response(
          JSON.stringify({
            code_url: "weixin://wxpay/bizpayurl?pr=native-route",
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
    }) as typeof fetch;
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

  it("creates WEB_NATIVE orders with QR payload", async () => {
    const response = await postNativeSponsorOrder(
      createJsonRequest("http://localhost/api/sponsorship/native-orders", {
        amount: "12.34",
        displayName: "Web User",
        message: "电脑端支付",
        termsAccepted: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      mode: "WEB_NATIVE",
      status: "PAYING",
      amountFen: 1234,
      codeUrl: "weixin://wxpay/bizpayurl?pr=native-route",
    });
  });

  it("does not redirect legacy JSON/form callers to ZPAY", async () => {
    const jsonResponse = await postLegacySponsorOrder(
      createJsonRequest("http://localhost/api/sponsorship/orders", {
        amount: "12.34",
        displayName: "Web User",
        message: "电脑端支付",
        termsAccepted: true,
      }),
    );

    expect(jsonResponse.status).toBe(410);
    expect(await jsonResponse.json()).toEqual({
      error: "Legacy H5 payment endpoint has been retired. Use /api/sponsorship/native-orders for desktop web payment or the mini program route for JSAPI payment.",
    });

    const formData = new FormData();
    formData.set("amount", "12.34");
    formData.set("displayName", "Mobile User");
    formData.set("message", "手机端");
    formData.set("termsAccepted", "on");
    const formResponse = await postLegacySponsorOrder(
      new Request("http://localhost/api/sponsorship/orders", {
        method: "POST",
        body: formData,
        headers: {
          "user-agent": "Mozilla/5.0 iPhone",
        },
      }),
    );

    expect(formResponse.status).toBe(303);
    expect(formResponse.headers.get("location")).toContain(
      "/sponsor/mini-program-jump",
    );
  });
});
