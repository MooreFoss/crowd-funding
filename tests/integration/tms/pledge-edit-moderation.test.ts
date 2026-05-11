import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import {
  createSponsorOrder,
  type PaymentGateway,
} from "@/src/application/payments";
import { reviewEditedPledgeText } from "@/src/application/admin";
import type { TextModerator } from "@/src/infrastructure/moderation";
import {
  createCampaignStateRepository,
  createModerationReviewRepository,
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
  const schemaName = `cf_tms_${randomUUID().replaceAll("-", "")}`;
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

async function createActiveTerms(context: TestContext) {
  const terms = await context.terms.create({
    version: "v1.0.0",
    title: "Crowdfunding Terms",
    body: "Terms body",
    status: "DRAFT",
    createdBy: "admin",
  });

  return context.terms.publish({
    id: terms.id,
    publishedAt: new Date("2026-05-10T10:00:00.000Z"),
  });
}

function createGateway(): PaymentGateway & {
  createNativePayment: ReturnType<typeof vi.fn>;
} {
  return {
    createMiniProgramPayment: vi.fn(async () => ({
      providerOrderNo: null,
      prepayId: "prepay-tms",
      payment: {
        timeStamp: "1760000000",
        nonceStr: "nonce",
        package: "prepay_id=prepay-tms",
        signType: "RSA",
        paySign: "signed",
      },
    })),
    createNativePayment: vi.fn(async () => ({
      providerOrderNo: "WECHATPAY-ORDER-TMS",
      codeUrl: "weixin://wxpay/bizpayurl?pr=tms",
    })),
    async queryOrder() {
      return {
        providerOrderNo: "WECHATPAY-ORDER-TMS",
        paid: false,
      };
    },
    async createRefund() {
      return {
        providerRefundNo: null,
        accepted: true,
      };
    },
    async verifyAndDecryptNotification() {
      return {
        eventType: "TRANSACTION.SUCCESS",
        resource: {},
      };
    },
  };
}

function createModerator(decide: (text: string) => "APPROVED" | "REJECTED" | "REVIEW_ERROR"): TextModerator {
  return {
    async moderateText(input) {
      const status = decide(input.text);

      return {
        status,
        requestId: `req-${input.dataId}`,
        failureSummary: status === "APPROVED" ? null : `${input.fieldName} blocked`,
        reviewedAt: new Date("2026-05-10T11:00:00.000Z"),
        retryCount: status === "REVIEW_ERROR" ? 1 : 0,
      };
    },
  };
}

describe("pledge text moderation integration", () => {
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

  it("rejects sponsor submissions before WeChat Pay order creation when public text fails TMS", async () => {
    await createActiveTerms(context);
    const gateway = createGateway();

    await expect(
      createSponsorOrder(
        {
          mode: "WEB_NATIVE",
          amount: "10.00",
          displayName: "Blocked nickname",
          message: "hello",
          termsAccepted: true,
          userKey: "user-tms-reject",
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
          moderator: createModerator((text) =>
            text.includes("Blocked") ? "REJECTED" : "APPROVED",
          ),
        },
      ),
    ).rejects.toThrow("未通过内容审核");

    const storedPledges = await context.pledges.listAdmin();
    const reviews = await context.moderationReviews.listBySubject(
      "PLEDGE",
      storedPledges[0]!.id,
    );

    expect(gateway.createNativePayment).not.toHaveBeenCalled();
    expect(storedPledges[0]).toMatchObject({
      status: "FAILED",
      publicName: null,
      publicMessage: null,
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      fieldName: "DISPLAY_NAME",
      status: "REJECTED",
    });
  });

  it("re-reviews admin edits and keeps the last approved public text until replacement passes", async () => {
    const activeTerms = await createActiveTerms(context);
    const pledge = await context.pledges.createPending({
      merchantOrderNo: "ADMIN-EDIT-TMS-1",
      paymentChannel: "WECHATPAY_NATIVE",
      userKey: "user-admin-edit",
      submittedName: "Clean name",
      publicName: "Clean name",
      submittedMessage: "Original message",
      publicMessage: "Original message",
      amountFen: 1_000,
      paymentRedirectUrl: null,
      termsVersionId: activeTerms.id,
      termsAcceptedAt: new Date("2026-05-10T09:00:00.000Z"),
    });
    await context.pledges.markPaymentOutcome({
      merchantOrderNo: pledge.merchantOrderNo,
      providerOrderNo: "WECHATPAY-ORDER-EDIT",
      status: "PAID",
      paidAt: new Date("2026-05-10T09:01:00.000Z"),
    });

    await expect(
      reviewEditedPledgeText(
        {
          pledgeId: pledge.id,
          displayName: "Rejected edit",
          message: "Replacement message",
        },
        {
          repositories: {
            moderationReviews: context.moderationReviews,
            pledges: context.pledges,
          },
          moderator: createModerator((text) =>
            text.includes("Rejected") ? "REJECTED" : "APPROVED",
          ),
        },
      ),
    ).rejects.toThrow("未通过内容审核");

    const afterRejectedEdit = await context.pledges.findById(pledge.id);
    const rejectedReviews = await context.moderationReviews.listBySubject(
      "PLEDGE_EDIT",
      pledge.id,
    );

    expect(afterRejectedEdit).toMatchObject({
      publicName: "Clean name",
      publicMessage: "Original message",
    });
    expect(rejectedReviews[0]).toMatchObject({
      fieldName: "DISPLAY_NAME",
      status: "REJECTED",
    });

    const approved = await reviewEditedPledgeText(
      {
        pledgeId: pledge.id,
        displayName: "Approved edit",
        message: "Replacement message",
      },
      {
        repositories: {
          moderationReviews: context.moderationReviews,
          pledges: context.pledges,
        },
        moderator: createModerator(() => "APPROVED"),
      },
    );
    const approvedReviews = await context.moderationReviews.listBySubject(
      "PLEDGE_EDIT",
      pledge.id,
    );

    expect(approved).toMatchObject({
      publicName: "Approved edit",
      publicMessage: "Replacement message",
    });
    expect(approvedReviews.filter((review) => review.status === "APPROVED")).toHaveLength(2);
  });
});
