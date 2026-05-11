import { createCipheriv, createSign, generateKeyPairSync, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildWechatPayAuthorization,
  createMiniProgramPaySign,
  decryptWechatPayResource,
} from "@/src/infrastructure/payments";

function createTestPrivateKeyPem() {
  const { privateKey } = generateKeyPairSync("rsa", {
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

  return privateKey;
}

function signBase64(message: string, privateKeyPem: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

function encryptWechatPayResource(input: {
  apiV3Key: string;
  associatedData: string;
  nonce: string;
  plaintext: string;
}) {
  const encryptor = createCipheriv(
    "aes-256-gcm",
    Buffer.from(input.apiV3Key, "utf8"),
    Buffer.from(input.nonce, "utf8"),
  );
  encryptor.setAAD(Buffer.from(input.associatedData, "utf8"));
  const encrypted = Buffer.concat([
    encryptor.update(input.plaintext, "utf8"),
    encryptor.final(),
  ]);
  const authTag = encryptor.getAuthTag();

  return Buffer.concat([encrypted, authTag]).toString("base64");
}

describe("wechatpay signature helpers", () => {
  it("builds a WECHATPAY2-SHA256-RSA2048 Authorization header from the canonical request", () => {
    const privateKeyPem = createTestPrivateKeyPem();
    const body = JSON.stringify({
      appid: "wx-app",
      mchid: "merchant-1001",
      out_trade_no: "ORDER-1001",
    });
    const authorization = buildWechatPayAuthorization({
      mchId: "merchant-1001",
      serialNo: "SERIAL-1001",
      privateKeyPem,
      method: "POST",
      urlPathWithQuery: "/v3/pay/transactions/jsapi",
      body,
      nonceStr: "nonce-1001",
      timestamp: "1760000000",
    });
    const expectedSignature = signBase64(
      `POST\n/v3/pay/transactions/jsapi\n1760000000\nnonce-1001\n${body}\n`,
      privateKeyPem,
    );

    expect(authorization).toContain("WECHATPAY2-SHA256-RSA2048");
    expect(authorization).toContain('mchid="merchant-1001"');
    expect(authorization).toContain('nonce_str="nonce-1001"');
    expect(authorization).toContain('timestamp="1760000000"');
    expect(authorization).toContain('serial_no="SERIAL-1001"');
    expect(authorization).toContain(`signature="${expectedSignature}"`);
  });

  it("creates wx.requestPayment parameters with a mini program RSA paySign", () => {
    const privateKeyPem = createTestPrivateKeyPem();
    const payment = createMiniProgramPaySign({
      appId: "wx-app",
      prepayId: "wx-prepay-1001",
      privateKeyPem,
      nonceStr: "pay-nonce",
      timeStamp: "1760000100",
    });

    expect(payment).toEqual({
      timeStamp: "1760000100",
      nonceStr: "pay-nonce",
      package: "prepay_id=wx-prepay-1001",
      signType: "RSA",
      paySign: signBase64(
        "wx-app\n1760000100\npay-nonce\nprepay_id=wx-prepay-1001\n",
        privateKeyPem,
      ),
    });
  });

  it("decrypts an AEAD_AES_256_GCM notification resource", () => {
    const apiV3Key = "12345678901234567890123456789012";
    const nonce = randomBytes(12).toString("base64url").slice(0, 12);
    const associatedData = "transaction";
    const plaintext = JSON.stringify({
      out_trade_no: "ORDER-1001",
      transaction_id: "4200001001",
      trade_state: "SUCCESS",
    });
    const ciphertext = encryptWechatPayResource({
      apiV3Key,
      associatedData,
      nonce,
      plaintext,
    });

    expect(
      decryptWechatPayResource({
        apiV3Key,
        associatedData,
        nonce,
        ciphertext,
      }),
    ).toBe(plaintext);
  });
});
