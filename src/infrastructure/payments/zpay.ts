import "server-only";

import { createHash } from "node:crypto";

type ZpayFetch = typeof fetch;

export type ZpayGatewayConfig = {
  merchantId: string;
  key: string;
  notifyUrl: string;
  returnUrl: string;
  endpoint?: string;
  orderQueryEndpoint?: string;
  fetch?: ZpayFetch;
};

export type ZpayCreateOrderInput = {
  merchantOrderNo: string;
  amountFen: number;
  clientIp: string;
  userKey: string;
  productName: string;
};

export type ZpayNotificationPayload = Record<string, string>;

function formatFenToPaymentAmount(amountFen: number) {
  return (amountFen / 100).toFixed(2);
}

function createMd5Digest(value: string) {
  return createHash("md5").update(value).digest("hex");
}

export function signZpayParams(
  parameters: Record<string, string | number | null | undefined>,
  key: string,
) {
  const canonical = Object.entries(parameters)
    .filter(([parameterKey, parameterValue]) => {
      if (
        parameterKey === "sign" ||
        parameterKey === "sign_type" ||
        parameterValue === null ||
        parameterValue === undefined
      ) {
        return false;
      }

      return String(parameterValue).length > 0;
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([parameterKey, parameterValue]) => `${parameterKey}=${parameterValue}`)
    .join("&");

  return createMd5Digest(`${canonical}&key=${key}`);
}

export function verifyZpaySignature(
  payload: Record<string, string | undefined>,
  key: string,
) {
  const sign = payload.sign;

  if (!sign) {
    return false;
  }

  return signZpayParams(payload, key) === sign;
}

export function createZpayGateway(config: ZpayGatewayConfig) {
  const fetchImplementation = config.fetch ?? fetch;
  const createOrderEndpoint = config.endpoint ?? "https://zpayz.cn/mapi.php";
  const orderQueryEndpoint = config.orderQueryEndpoint ?? "https://zpayz.cn/api.php";

  return {
    async createH5Payment(input: ZpayCreateOrderInput) {
      const payload = {
        pid: config.merchantId,
        type: "wxpay",
        out_trade_no: input.merchantOrderNo,
        notify_url: config.notifyUrl,
        return_url: config.returnUrl,
        name: input.productName,
        money: formatFenToPaymentAmount(input.amountFen),
        clientip: input.clientIp,
        device: "mobile",
        param: input.userKey,
      };
      const formData = new URLSearchParams();

      for (const [key, value] of Object.entries(payload)) {
        formData.set(key, value);
      }

      formData.set("sign", signZpayParams(payload, config.key));
      formData.set("sign_type", "MD5");

      const response = await fetchImplementation(createOrderEndpoint, {
        method: "POST",
        body: formData,
      });
      const body = await response.json() as {
        code?: number;
        msg?: string;
        trade_no?: string;
        payurl?: string;
        payurl2?: string;
      };

      if (
        !response.ok ||
        body.code !== 1 ||
        !body.trade_no ||
        !(body.payurl2 || body.payurl)
      ) {
        throw new Error(body.msg ?? "ZPAY order creation failed.");
      }

      return {
        providerOrderNo: body.trade_no,
        paymentRedirectUrl: body.payurl2 ?? body.payurl!,
      };
    },

    async queryOrder(input: { merchantOrderNo: string }) {
      const query = new URL(orderQueryEndpoint);
      query.searchParams.set("act", "order");
      query.searchParams.set("pid", config.merchantId);
      query.searchParams.set("key", config.key);
      query.searchParams.set("out_trade_no", input.merchantOrderNo);

      const response = await fetchImplementation(query, {
        method: "GET",
      });
      const body = await response.json() as {
        code?: number;
        msg?: string;
        trade_no?: string;
        status?: number | string;
      };

      if (!response.ok || body.code !== 1) {
        throw new Error(body.msg ?? "ZPAY order query failed.");
      }

      return {
        providerOrderNo: body.trade_no ?? null,
        paid: String(body.status) === "1",
      };
    },

    verifyNotification(payload: ZpayNotificationPayload) {
      return verifyZpaySignature(payload, config.key);
    },
  };
}
