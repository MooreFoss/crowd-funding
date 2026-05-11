import "server-only";

import {
  createDecipheriv,
  createSign,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type WechatPayFetch = typeof fetch;

export type WechatPayGatewayConfig = {
  appId: string;
  mchId: string;
  apiV3Key: string;
  merchantSerialNo: string;
  merchantPrivateKeyPem: string;
  wechatPayPublicKeyId: string;
  wechatPayPublicKeyPem: string;
  notifyUrl: string;
  refundNotifyUrl: string;
  fetch?: WechatPayFetch;
};

export type MiniProgramPaymentParameters = {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
};

export type WechatPayNotificationResult = {
  eventType: string;
  resource: Record<string, unknown>;
};

function createNonce() {
  return randomBytes(16).toString("base64url").slice(0, 32);
}

function createTimestamp() {
  return String(Math.floor(Date.now() / 1000));
}

function signRsaSha256(message: string, privateKeyPem: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();

  return signer.sign(privateKeyPem, "base64");
}

function parseJsonObject(value: string, errorMessage: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(errorMessage);
  }

  return parsed as Record<string, unknown>;
}

function assertWechatPaySuccessResponse(
  response: Response,
  body: Record<string, unknown>,
  fallbackMessage: string,
) {
  if (!response.ok) {
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.detail === "string"
          ? body.detail
          : fallbackMessage;

    throw new Error(message);
  }
}

function createWechatPayHeaders(input: {
  config: WechatPayGatewayConfig;
  method: string;
  urlPathWithQuery: string;
  body: string;
}) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: buildWechatPayAuthorization({
      mchId: input.config.mchId,
      serialNo: input.config.merchantSerialNo,
      privateKeyPem: input.config.merchantPrivateKeyPem,
      method: input.method,
      urlPathWithQuery: input.urlPathWithQuery,
      body: input.body,
    }),
  };
}

function buildWechatPayApiUrl(pathWithQuery: string) {
  return new URL(
    pathWithQuery,
    process.env.WECHAT_PAY_API_ENDPOINT ?? "https://api.mch.weixin.qq.com",
  );
}

function readWechatPayHeader(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? "";
}

function verifyWechatPaySignature(input: {
  body: string;
  headers: Headers;
  publicKeyPem: string;
}) {
  const timestamp = readWechatPayHeader(input.headers, "Wechatpay-Timestamp");
  const nonce = readWechatPayHeader(input.headers, "Wechatpay-Nonce");
  const signature = readWechatPayHeader(input.headers, "Wechatpay-Signature");

  if (!timestamp || !nonce || !signature) {
    return false;
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${timestamp}\n${nonce}\n${input.body}\n`);
  verifier.end();

  return verifier.verify(input.publicKeyPem, signature, "base64");
}

export function buildWechatPayAuthorization(input: {
  mchId: string;
  serialNo: string;
  privateKeyPem: string;
  method: string;
  urlPathWithQuery: string;
  body: string;
  nonceStr?: string;
  timestamp?: string;
}) {
  const timestamp = input.timestamp ?? createTimestamp();
  const nonceStr = input.nonceStr ?? createNonce();
  const message = `${input.method.toUpperCase()}\n${input.urlPathWithQuery}\n${timestamp}\n${nonceStr}\n${input.body}\n`;
  const signature = signRsaSha256(message, input.privateKeyPem);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${input.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${input.serialNo}",signature="${signature}"`;
}

export function createMiniProgramPaySign(input: {
  appId: string;
  prepayId: string;
  privateKeyPem: string;
  nonceStr?: string;
  timeStamp?: string;
}): MiniProgramPaymentParameters {
  const timeStamp = input.timeStamp ?? createTimestamp();
  const nonceStr = input.nonceStr ?? createNonce();
  const packageValue = `prepay_id=${input.prepayId}`;
  const paySign = signRsaSha256(
    `${input.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`,
    input.privateKeyPem,
  );

  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: "RSA",
    paySign,
  };
}

export function decryptWechatPayResource(input: {
  apiV3Key: string;
  associatedData?: string;
  nonce: string;
  ciphertext: string;
}) {
  const encryptedBuffer = Buffer.from(input.ciphertext, "base64");
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
  const encrypted = encryptedBuffer.subarray(0, encryptedBuffer.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(input.apiV3Key, "utf8"),
    Buffer.from(input.nonce, "utf8"),
  );

  if (input.associatedData) {
    decipher.setAAD(Buffer.from(input.associatedData, "utf8"));
  }

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createWechatPayGateway(config: WechatPayGatewayConfig) {
  const fetchImplementation = config.fetch ?? fetch;

  async function requestWechatPay(pathWithQuery: string, init: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
  }) {
    const body = init.body ? JSON.stringify(init.body) : "";
    const response = await fetchImplementation(buildWechatPayApiUrl(pathWithQuery), {
      method: init.method,
      headers: createWechatPayHeaders({
        config,
        method: init.method,
        urlPathWithQuery: pathWithQuery,
        body,
      }),
      body: body || undefined,
    });
    const responseText = await response.text();
    const responseBody = responseText ? parseJsonObject(responseText, "Invalid WeChat Pay JSON response.") : {};

    assertWechatPaySuccessResponse(
      response,
      responseBody,
      "WeChat Pay request failed.",
    );

    return responseBody;
  }

  return {
    async createMiniProgramPayment(input: {
      merchantOrderNo: string;
      amountFen: number;
      clientIp: string;
      openid: string;
      productName: string;
    }) {
      const body = {
        appid: config.appId,
        mchid: config.mchId,
        description: input.productName,
        out_trade_no: input.merchantOrderNo,
        notify_url: config.notifyUrl,
        amount: {
          total: input.amountFen,
        },
        payer: {
          openid: input.openid,
        },
        scene_info: {
          payer_client_ip: input.clientIp,
        },
      };
      const responseBody = await requestWechatPay("/v3/pay/transactions/jsapi", {
        method: "POST",
        body,
      });
      const prepayId = responseBody.prepay_id;

      if (typeof prepayId !== "string" || !prepayId) {
        throw new Error("WeChat Pay JSAPI response is missing prepay_id.");
      }

      return {
        providerOrderNo: null,
        prepayId,
        payment: createMiniProgramPaySign({
          appId: config.appId,
          prepayId,
          privateKeyPem: config.merchantPrivateKeyPem,
        }),
      };
    },

    async createNativePayment(input: {
      merchantOrderNo: string;
      amountFen: number;
      clientIp: string;
      productName: string;
    }) {
      const body = {
        appid: config.appId,
        mchid: config.mchId,
        description: input.productName,
        out_trade_no: input.merchantOrderNo,
        notify_url: config.notifyUrl,
        amount: {
          total: input.amountFen,
        },
        scene_info: {
          payer_client_ip: input.clientIp,
        },
      };
      const responseBody = await requestWechatPay("/v3/pay/transactions/native", {
        method: "POST",
        body,
      });
      const codeUrl = responseBody.code_url;

      if (typeof codeUrl !== "string" || !codeUrl) {
        throw new Error("WeChat Pay Native response is missing code_url.");
      }

      return {
        providerOrderNo: null,
        codeUrl,
      };
    },

    async queryOrder(input: { merchantOrderNo: string }) {
      const encodedOrderNo = encodeURIComponent(input.merchantOrderNo);
      const path = `/v3/pay/transactions/out-trade-no/${encodedOrderNo}?mchid=${encodeURIComponent(config.mchId)}`;
      const responseBody = await requestWechatPay(path, {
        method: "GET",
      });
      const tradeState =
        typeof responseBody.trade_state === "string"
          ? responseBody.trade_state
          : null;

      return {
        providerOrderNo:
          typeof responseBody.transaction_id === "string"
            ? responseBody.transaction_id
            : null,
        paid: tradeState === "SUCCESS",
        tradeState,
      };
    },

    async createRefund(input: {
      merchantOrderNo: string;
      merchantRefundNo: string;
      amountFen: number;
      reason: string;
    }) {
      const body = {
        out_trade_no: input.merchantOrderNo,
        out_refund_no: input.merchantRefundNo,
        reason: input.reason,
        notify_url: config.refundNotifyUrl,
        amount: {
          refund: input.amountFen,
          total: input.amountFen,
          currency: "CNY",
        },
      };
      const responseBody = await requestWechatPay("/v3/refund/domestic/refunds", {
        method: "POST",
        body,
      });

      return {
        providerRefundNo:
          typeof responseBody.refund_id === "string"
            ? responseBody.refund_id
            : null,
        accepted: true,
      };
    },

    async verifyAndDecryptNotification(input: {
      body: string;
      headers: Headers;
    }): Promise<WechatPayNotificationResult> {
      const serial = readWechatPayHeader(input.headers, "Wechatpay-Serial");

      if (
        config.wechatPayPublicKeyId &&
        serial &&
        !safeEqual(serial, config.wechatPayPublicKeyId)
      ) {
        throw new Error("WeChat Pay notification serial does not match configured public key.");
      }

      if (
        !verifyWechatPaySignature({
          body: input.body,
          headers: input.headers,
          publicKeyPem: config.wechatPayPublicKeyPem,
        })
      ) {
        throw new Error("Invalid WeChat Pay notification signature.");
      }

      const notification = parseJsonObject(
        input.body,
        "Invalid WeChat Pay notification payload.",
      );
      const resource = notification.resource;

      if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
        throw new Error("WeChat Pay notification is missing encrypted resource.");
      }

      const encryptedResource = resource as Record<string, unknown>;
      const nonce = encryptedResource.nonce;
      const ciphertext = encryptedResource.ciphertext;

      if (typeof nonce !== "string" || typeof ciphertext !== "string") {
        throw new Error("WeChat Pay encrypted resource is invalid.");
      }

      const decrypted = parseJsonObject(
        decryptWechatPayResource({
          apiV3Key: config.apiV3Key,
          associatedData:
            typeof encryptedResource.associated_data === "string"
              ? encryptedResource.associated_data
              : undefined,
          nonce,
          ciphertext,
        }),
        "Invalid decrypted WeChat Pay notification resource.",
      );

      return {
        eventType:
          typeof notification.event_type === "string"
            ? notification.event_type
            : "",
        resource: decrypted,
      };
    },
  };
}
