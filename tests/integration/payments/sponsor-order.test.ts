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
  createCampaignStateRepository,
  createModerationReviewRepository,
  createPledgeRepository,
  createTermsRepository,
} from "@/src/infrastructure/persistence/repositories";
import type { TextModerator } from "@/src/infrastructure/moderation";

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
    campaignState: createCampaignStateRepository(client),
    moderationReviews: createModerationReviewRepository(client),
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

const approvingModerator: TextModerator = {
  async moderateText(input) {
    return {
      status: "APPROVED",
      requestId: `req-${input.dataId}`,
      failureSummary: null,
      reviewedAt: new Date("2026-05-10T10:30:00.000Z"),
      retryCount: 0,
    };
  },
};

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

  it("creates a Native sponsor order, binds the active terms version, and records the QR payload", async () => {
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
      async createMiniProgramPayment() {
        throw new Error("should not create JSAPI payment");
      },
      async createNativePayment(input) {
        expect(input).toMatchObject({
          merchantOrderNo: "ORDER-NATIVE-1001",
          amountFen: 1_234,
          clientIp: "127.0.0.1",
          productName: "众筹赞助支持",
        });
        return {
          providerOrderNo: null,
          codeUrl: "weixin://wxpay/bizpayurl?pr=native-1001",
        };
      },
      async queryOrder() {
        return {
          providerOrderNo: "WECHATPAY-ORDER-1001",
          paid: false,
        };
      },
      verifyNotification() {
        return false;
      },
    };

    const order = await createSponsorOrder(
      {
        mode: "WEB_NATIVE",
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
          campaignState: context.campaignState,
          moderationReviews: context.moderationReviews,
          pledges: context.pledges,
          terms: context.terms,
        },
        gateway,
        moderator: approvingModerator,
        merchantOrderNoFactory: () => "ORDER-NATIVE-1001",
      },
    );

    const stored = await context.pledges.findByMerchantOrderNo(order.merchantOrderNo);

    expect(order.status).toBe("PAYING");
    expect(order.mode).toBe("WEB_NATIVE");
    expect(order.amountFen).toBe(1_234);
    expect(order.codeUrl).toBe("weixin://wxpay/bizpayurl?pr=native-1001");
    expect(order.termsVersionId).toBe(activeTerms.id);
    expect(stored).toMatchObject({
      status: "PAYING",
      paymentChannel: "WECHATPAY_NATIVE",
      amountFen: 1_234,
      userKey: "session-user-1",
      publicName: "Alice",
      publicMessage: "Thanks for building this.",
      termsVersionId: activeTerms.id,
      paymentRedirectUrl: "weixin://wxpay/bizpayurl?pr=native-1001",
      providerOrderNo: null,
    });
  });

  it("creates a mini program JSAPI sponsor order and requires openid", async () => {
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
      async createMiniProgramPayment(input) {
        expect(input.openid).toBe("openid-1001");
        return {
          providerOrderNo: null,
          prepayId: "prepay-1001",
          payment: {
            timeStamp: "1760000000",
            nonceStr: "nonce",
            package: "prepay_id=prepay-1001",
            signType: "RSA",
            paySign: "signed",
          },
        };
      },
      async createNativePayment() {
        throw new Error("should not create Native payment");
      },
      async queryOrder() {
        return {
          providerOrderNo: null,
          paid: false,
        };
      },
      async verifyAndDecryptNotification() {
        throw new Error("not needed");
      },
    };

    await expect(
      createSponsorOrder(
        {
          mode: "MINI_PROGRAM_JSAPI",
          amount: "8.88",
          displayName: "Mini",
          message: "Mini program support",
          termsAccepted: true,
          userKey: "mini-user-1",
          clientIp: "127.0.0.1",
          userAgent: "MicroMessenger",
        },
        {
          repositories: {
            campaignState: context.campaignState,
            moderationReviews: context.moderationReviews,
            pledges: context.pledges,
            terms: context.terms,
          },
          gateway,
          moderator: approvingModerator,
        },
      ),
    ).rejects.toThrow("Mini program openid is required.");

    const order = await createSponsorOrder(
      {
        mode: "MINI_PROGRAM_JSAPI",
        amount: "8.88",
        displayName: "Mini",
        message: "Mini program support",
        termsAccepted: true,
        userKey: "mini-user-1",
        clientIp: "127.0.0.1",
        userAgent: "MicroMessenger",
        openid: "openid-1001",
      },
      {
        repositories: {
          campaignState: context.campaignState,
          moderationReviews: context.moderationReviews,
          pledges: context.pledges,
          terms: context.terms,
        },
        gateway,
        moderator: approvingModerator,
      },
    );
    const stored = await context.pledges.findByMerchantOrderNo(order.merchantOrderNo);

    expect(order).toMatchObject({
      mode: "MINI_PROGRAM_JSAPI",
      amountFen: 888,
      status: "PAYING",
      payment: {
        package: "prepay_id=prepay-1001",
        signType: "RSA",
      },
    });
    expect(stored).toMatchObject({
      paymentChannel: "WECHATPAY_MINI_PROGRAM",
      paymentRedirectUrl: "prepay_id=prepay-1001",
      status: "PAYING",
    });
  });

  it("rejects invalid sponsor-order submissions before any pledge is created", async () => {
    const gateway: PaymentGateway = {
      async createMiniProgramPayment() {
        throw new Error("should not reach gateway");
      },
      async createNativePayment() {
        throw new Error("should not reach gateway");
      },
      async queryOrder() {
        throw new Error("should not query gateway");
      },
      async verifyAndDecryptNotification() {
        throw new Error("not needed");
      },
    };

    await expect(
      createSponsorOrder(
        {
          mode: "WEB_NATIVE",
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
            campaignState: context.campaignState,
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
      async createMiniProgramPayment() {
        throw new Error("should not create JSAPI payment");
      },
      async createNativePayment() {
        return {
          providerOrderNo: "WECHATPAY-ORDER-2001",
          codeUrl: "weixin://wxpay/bizpayurl?pr=native-2001",
        };
      },
      async queryOrder() {
        return {
          providerOrderNo: "WECHATPAY-ORDER-2001",
          paid: true,
        };
      },
      async verifyAndDecryptNotification() {
        throw new Error("not needed");
      },
    };

    const order = await createSponsorOrder(
      {
        mode: "WEB_NATIVE",
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
          campaignState: context.campaignState,
          moderationReviews: context.moderationReviews,
          pledges: context.pledges,
          terms: context.terms,
        },
        gateway,
        moderator: approvingModerator,
      },
    );

    const firstConfirmation = await confirmPaymentNotification(
      {
        merchantOrderNo: order.merchantOrderNo,
        providerOrderNo: "WECHATPAY-ORDER-2001",
        paid: true,
      },
      {
        pledges: context.pledges,
      },
    );
    const secondConfirmation = await confirmPaymentNotification(
      {
        merchantOrderNo: order.merchantOrderNo,
        providerOrderNo: "WECHATPAY-ORDER-2001",
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
      providerOrderNo: "WECHATPAY-ORDER-2001",
    });
  });
});
