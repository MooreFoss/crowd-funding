import { createCipheriv, createSign, generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { POST as postPaymentNotify } from "@/app/api/payments/notify/route";
import { createWechatPayGateway } from "@/src/infrastructure/payments";

function createKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki",
    },
  });
}

function signBase64(message: string, privateKeyPem: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

function encryptResource(input: {
  apiV3Key: string;
  associatedData: string;
  nonce: string;
  plaintext: string;
}) {
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(input.apiV3Key),
    Buffer.from(input.nonce),
  );
  cipher.setAAD(Buffer.from(input.associatedData));
  const encrypted = Buffer.concat([
    cipher.update(input.plaintext, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64");
}

function createTestGateway(fetchMock: typeof fetch) {
  const merchantKeys = createKeyPair();
  const wechatPayKeys = createKeyPair();

  return {
    gateway: createWechatPayGateway({
      appId: "wx-app-1001",
      mchId: "mch-1001",
      apiV3Key: "12345678901234567890123456789012",
      merchantSerialNo: "merchant-serial-1001",
      merchantPrivateKeyPem: merchantKeys.privateKey,
      wechatPayPublicKeyId: "wechatpay-serial-1001",
      wechatPayPublicKeyPem: wechatPayKeys.publicKey,
      notifyUrl: "https://example.com/api/payments/notify",
      refundNotifyUrl: "https://example.com/api/refunds/notify",
      fetch: fetchMock,
    }),
    wechatPayPrivateKeyPem: wechatPayKeys.privateKey,
  };
}

describe("wechatpay-flow adapter", () => {
  it("creates JSAPI orders with mini program openid and returns requestPayment parameters", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        appid?: string;
        mchid?: string;
        description?: string;
        out_trade_no?: string;
        notify_url?: string;
        amount?: { total?: number };
        payer?: { openid?: string };
      };

      expect(String(_input)).toBe(
        "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi",
      );
      expect(init?.method).toBe("POST");
      expect(body).toMatchObject({
        appid: "wx-app-1001",
        mchid: "mch-1001",
        description: "众筹赞助支持",
        out_trade_no: "ORDER-JSAPI-1001",
        notify_url: "https://example.com/api/payments/notify",
        amount: {
          total: 1234,
        },
        payer: {
          openid: "openid-1001",
        },
      });
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(String((init?.headers as Record<string, string>).Authorization)).toContain(
        "WECHATPAY2-SHA256-RSA2048",
      );

      return new Response(JSON.stringify({ prepay_id: "prepay-jsapi-1001" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });
    const { gateway } = createTestGateway(fetchMock as typeof fetch);

    const order = await gateway.createMiniProgramPayment({
      merchantOrderNo: "ORDER-JSAPI-1001",
      amountFen: 1_234,
      clientIp: "127.0.0.1",
      openid: "openid-1001",
      productName: "众筹赞助支持",
    });

    expect(order.providerOrderNo).toBeNull();
    expect(order.prepayId).toBe("prepay-jsapi-1001");
    expect(order.payment).toMatchObject({
      package: "prepay_id=prepay-jsapi-1001",
      signType: "RSA",
    });
    expect(order.payment.paySign).toBeTruthy();
  });

  it("creates Native orders and returns the QR code URL payload", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        appid?: string;
        mchid?: string;
        out_trade_no?: string;
        amount?: { total?: number };
      };

      expect(String(_input)).toBe(
        "https://api.mch.weixin.qq.com/v3/pay/transactions/native",
      );
      expect(body).toMatchObject({
        appid: "wx-app-1001",
        mchid: "mch-1001",
        out_trade_no: "ORDER-NATIVE-1001",
        amount: {
          total: 2000,
        },
      });

      return new Response(
        JSON.stringify({ code_url: "weixin://wxpay/bizpayurl?pr=test" }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    const { gateway } = createTestGateway(fetchMock as typeof fetch);

    await expect(
      gateway.createNativePayment({
        merchantOrderNo: "ORDER-NATIVE-1001",
        amountFen: 2_000,
        clientIp: "127.0.0.1",
        productName: "众筹赞助支持",
      }),
    ).resolves.toEqual({
      providerOrderNo: null,
      codeUrl: "weixin://wxpay/bizpayurl?pr=test",
    });
  });

  it("queries paid orders and submits refund requests to official endpoints", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/v3/pay/transactions/out-trade-no/ORDER-QUERY-1001")) {
        expect(init?.method).toBe("GET");
        expect(url).toContain("mchid=mch-1001");
        return new Response(
          JSON.stringify({
            transaction_id: "4200001001",
            out_trade_no: "ORDER-QUERY-1001",
            trade_state: "SUCCESS",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (url.endsWith("/v3/refund/domestic/refunds")) {
        const body = JSON.parse(String(init?.body)) as {
          out_trade_no?: string;
          out_refund_no?: string;
          notify_url?: string;
          amount?: {
            refund?: number;
            total?: number;
            currency?: string;
          };
        };

        expect(body).toMatchObject({
          out_trade_no: "ORDER-QUERY-1001",
          out_refund_no: "REFUND-1001",
          notify_url: "https://example.com/api/refunds/notify",
          amount: {
            refund: 500,
            total: 500,
            currency: "CNY",
          },
        });

        return new Response(
          JSON.stringify({
            refund_id: "5030001001",
            out_refund_no: "REFUND-1001",
            status: "PROCESSING",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    const { gateway } = createTestGateway(fetchMock as typeof fetch);

    await expect(
      gateway.queryOrder({ merchantOrderNo: "ORDER-QUERY-1001" }),
    ).resolves.toEqual({
      providerOrderNo: "4200001001",
      paid: true,
      tradeState: "SUCCESS",
    });
    await expect(
      gateway.createRefund({
        merchantOrderNo: "ORDER-QUERY-1001",
        merchantRefundNo: "REFUND-1001",
        amountFen: 500,
        reason: "测试退款",
      }),
    ).resolves.toEqual({
      providerRefundNo: "5030001001",
      accepted: true,
    });
  });

  it("verifies and decrypts payment notifications before exposing the resource", async () => {
    const { gateway, wechatPayPrivateKeyPem } = createTestGateway(
      vi.fn() as unknown as typeof fetch,
    );
    const resourcePlaintext = JSON.stringify({
      out_trade_no: "ORDER-NOTIFY-1001",
      transaction_id: "4200002001",
      trade_state: "SUCCESS",
      trade_type: "JSAPI",
    });
    const body = JSON.stringify({
      id: "notify-1001",
      event_type: "TRANSACTION.SUCCESS",
      resource_type: "encrypt-resource",
      resource: {
        algorithm: "AEAD_AES_256_GCM",
        ciphertext: encryptResource({
          apiV3Key: "12345678901234567890123456789012",
          associatedData: "transaction",
          nonce: "notifyNonce12",
          plaintext: resourcePlaintext,
        }),
        associated_data: "transaction",
        original_type: "transaction",
        nonce: "notifyNonce12",
      },
    });
    const timestamp = "1760000200";
    const nonce = "callback-nonce";
    const signature = signBase64(
      `${timestamp}\n${nonce}\n${body}\n`,
      wechatPayPrivateKeyPem,
    );
    const headers = new Headers({
      "Wechatpay-Serial": "wechatpay-serial-1001",
      "Wechatpay-Timestamp": timestamp,
      "Wechatpay-Nonce": nonce,
      "Wechatpay-Signature": signature,
    });

    await expect(
      gateway.verifyAndDecryptNotification({
        body,
        headers,
      }),
    ).resolves.toEqual({
      eventType: "TRANSACTION.SUCCESS",
      resource: {
        out_trade_no: "ORDER-NOTIFY-1001",
        transaction_id: "4200002001",
        trade_state: "SUCCESS",
        trade_type: "JSAPI",
      },
    });

    const invalidHeaders = new Headers(headers);
    invalidHeaders.set(
      "Wechatpay-Signature",
      `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`,
    );

    await expect(
      gateway.verifyAndDecryptNotification({
        body,
        headers: invalidHeaders,
      }),
    ).rejects.toThrow("Invalid WeChat Pay notification signature.");
  });

  it("payment notify route rejects invalid signatures before changing pledge state", async () => {
    const originalFactory = await import("@/src/application/payments");
    void originalFactory;

    const response = await postPaymentNotify(
      new Request("http://localhost/api/payments/notify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: "bad-notify",
          event_type: "TRANSACTION.SUCCESS",
          resource: {},
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid WeChat Pay notification signature.",
    });
  });
});
