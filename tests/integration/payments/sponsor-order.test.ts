import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  confirmPaymentNotification,
  createSponsorOrder,
  type PaymentGateway,
} from "@/src/application/payments";
import {
  createPledgeRepository,
  createTermsRepository,
} from "@/src/infrastructure/persistence/repositories";

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
  const schemaName = `cf_payment_${randomUUID().replaceAll("-", "")}`;
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

describe("sponsor-order flow", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    if (context) {
      await destroyTestContext(context);
      context = undefined;
    }
  });

  it("creates a pending sponsor order, binds the active terms version, and records the H5 redirect", async () => {
    const draftTerms = await context.terms.create({
      version: "v1.0.0",
      title: "Crowdfunding Terms",
      body: "Terms body",
      status: "DRAFT",
      createdBy: "admin",
    });
    const activeTerms = await context.terms.publish({
      id: draftTerms.id,
      publishedAt: new Date("2026-05-10T10:00:00.000Z"),
    });

    const gateway: PaymentGateway = {
      async createH5Payment() {
        return {
          providerOrderNo: "ZPAY-ORDER-1001",
          paymentRedirectUrl: "https://zpay.example.com/pay/h5-1001",
        };
      },
      async queryOrder() {
        return {
          providerOrderNo: "ZPAY-ORDER-1001",
          paid: false,
        };
      },
      verifyNotification() {
        return false;
      },
    };

    const order = await createSponsorOrder(
      {
        amount: "12.34",
        displayName: "Alice",
        message: "Thanks for building this.",
        termsAccepted: true,
        userKey: "session-user-1",
        clientIp: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      },
      {
        repositories: {
          pledges: context.pledges,
          terms: context.terms,
        },
        gateway,
      },
    );

    const stored = await context.pledges.findByMerchantOrderNo(order.merchantOrderNo);

    expect(order.status).toBe("PAYING");
    expect(order.amountFen).toBe(1_234);
    expect(order.paymentRedirectUrl).toBe("https://zpay.example.com/pay/h5-1001");
    expect(order.termsVersionId).toBe(activeTerms.id);
    expect(stored).toMatchObject({
      status: "PAYING",
      amountFen: 1_234,
      userKey: "session-user-1",
      publicName: "Alice",
      publicMessage: "Thanks for building this.",
      termsVersionId: activeTerms.id,
      paymentRedirectUrl: "https://zpay.example.com/pay/h5-1001",
      providerOrderNo: "ZPAY-ORDER-1001",
    });
  });

  it("rejects invalid sponsor-order submissions before any pledge is created", async () => {
    const gateway: PaymentGateway = {
      async createH5Payment() {
        throw new Error("should not reach gateway");
      },
      async queryOrder() {
        throw new Error("should not query gateway");
      },
      verifyNotification() {
        return false;
      },
    };

    await expect(
      createSponsorOrder(
        {
          amount: "0",
          displayName: "Alice",
          message: "bad amount",
          termsAccepted: false,
          userKey: "session-user-2",
          clientIp: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        },
        {
          repositories: {
            pledges: context.pledges,
            terms: context.terms,
          },
          gateway,
        },
      ),
    ).rejects.toThrow();

    expect(await context.pledges.listAdmin()).toHaveLength(0);
  });

  it("applies repeated payment confirmations idempotently to the same sponsor order", async () => {
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

    const gateway: PaymentGateway = {
      async createH5Payment() {
        return {
          providerOrderNo: "ZPAY-ORDER-2001",
          paymentRedirectUrl: "https://zpay.example.com/pay/h5-2001",
        };
      },
      async queryOrder() {
        return {
          providerOrderNo: "ZPAY-ORDER-2001",
          paid: true,
        };
      },
      verifyNotification() {
        return true;
      },
    };

    const order = await createSponsorOrder(
      {
        amount: "20.00",
        displayName: "Bob",
        message: "Idempotent callback",
        termsAccepted: true,
        userKey: "session-user-3",
        clientIp: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      },
      {
        repositories: {
          pledges: context.pledges,
          terms: context.terms,
        },
        gateway,
      },
    );

    const firstConfirmation = await confirmPaymentNotification(
      {
        merchantOrderNo: order.merchantOrderNo,
        providerOrderNo: "ZPAY-ORDER-2001",
        paid: true,
      },
      {
        pledges: context.pledges,
      },
    );
    const secondConfirmation = await confirmPaymentNotification(
      {
        merchantOrderNo: order.merchantOrderNo,
        providerOrderNo: "ZPAY-ORDER-2001",
        paid: true,
      },
      {
        pledges: context.pledges,
      },
    );
    const stored = await context.pledges.findByMerchantOrderNo(order.merchantOrderNo);

    expect(firstConfirmation?.status).toBe("PAID");
    expect(secondConfirmation?.status).toBe("PAID");
    expect(stored).toMatchObject({
      status: "PAID",
      amountFen: 2_000,
      netAmountFen: 2_000,
      refundedFen: 0,
      providerOrderNo: "ZPAY-ORDER-2001",
    });
  });
});
