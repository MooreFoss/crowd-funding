import { describe, expect, it, vi } from "vitest";

import {
  createZpayGateway,
  signZpayParams,
  verifyZpaySignature,
} from "@/src/infrastructure/payments";

describe("zpay-flow adapter", () => {
  it("signs order parameters, prefers the H5 jump address, and parses the provider order number", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;

      expect(body.get("pid")).toBe("merchant-1001");
      expect(body.get("type")).toBe("wxpay");
      expect(body.get("out_trade_no")).toBe("ORDER-1001");
      expect(body.get("money")).toBe("12.34");
      expect(body.get("return_url")).toBe("https://example.com/payment/return");
      expect(body.get("notify_url")).toBe("https://example.com/api/payments/notify");
      expect(body.get("sign_type")).toBe("MD5");
      expect(body.get("sign")).toBe(
        signZpayParams(
          {
            clientip: "127.0.0.1",
            device: "mobile",
            money: "12.34",
            name: "众筹赞助支持",
            notify_url: "https://example.com/api/payments/notify",
            out_trade_no: "ORDER-1001",
            param: "session-user-1",
            pid: "merchant-1001",
            return_url: "https://example.com/payment/return",
            type: "wxpay",
          },
          "signing-key",
        ),
      );

      return new Response(
        JSON.stringify({
          code: 1,
          msg: "success",
          O_id: "OID-1001",
          trade_no: "ZPAY-ORDER-1001",
          payurl: "https://cashier.example.com/order/1001",
          payurl2: "https://cashier.example.com/h5/1001",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const gateway = createZpayGateway({
      merchantId: "merchant-1001",
      key: "signing-key",
      notifyUrl: "https://example.com/api/payments/notify",
      returnUrl: "https://example.com/payment/return",
      fetch: fetchMock,
    });

    const order = await gateway.createH5Payment({
      merchantOrderNo: "ORDER-1001",
      amountFen: 1_234,
      clientIp: "127.0.0.1",
      userKey: "session-user-1",
      productName: "众筹赞助支持",
    });

    expect(order).toEqual({
      providerOrderNo: "ZPAY-ORDER-1001",
      paymentRedirectUrl: "https://cashier.example.com/h5/1001",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("verifies callback signatures and exposes query-order payment state", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          code: 1,
          msg: "success",
          trade_no: "ZPAY-ORDER-1001",
          out_trade_no: "ORDER-1001",
          status: 1,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const gateway = createZpayGateway({
      merchantId: "merchant-1001",
      key: "signing-key",
      notifyUrl: "https://example.com/api/payments/notify",
      returnUrl: "https://example.com/payment/return",
      fetch: fetchMock,
    });

    const callbackPayload = {
      pid: "merchant-1001",
      trade_no: "ZPAY-ORDER-1001",
      out_trade_no: "ORDER-1001",
      type: "wxpay",
      name: "众筹赞助支持",
      money: "12.34",
      trade_status: "TRADE_SUCCESS",
    };
    const sign = signZpayParams(callbackPayload, "signing-key");

    expect(
      verifyZpaySignature(
        {
          ...callbackPayload,
          sign,
          sign_type: "MD5",
        },
        "signing-key",
      ),
    ).toBe(true);
    expect(
      gateway.verifyNotification({
        ...callbackPayload,
        sign: `${sign}bad`,
        sign_type: "MD5",
      }),
    ).toBe(false);

    const queryResult = await gateway.queryOrder({
      merchantOrderNo: "ORDER-1001",
    });

    expect(queryResult).toEqual({
      providerOrderNo: "ZPAY-ORDER-1001",
      paid: true,
    });
  });
});
