import { readFileSync } from "node:fs";

import { serverEnv } from "@/src/config/env";
import { createWechatPayGateway, createZpayGateway } from "@/src/infrastructure/payments";

export const SPONSOR_USER_KEY_COOKIE_NAME = "cf_sponsor_user";
export const LAST_SPONSOR_ORDER_COOKIE_NAME = "cf_last_sponsor_order";

export function createConfiguredPaymentGateway() {
  return createConfiguredWechatPayGateway();
}

export function createConfiguredWechatPayGateway() {
  return createWechatPayGateway({
    appId: serverEnv.wechatPayAppId,
    mchId: serverEnv.wechatPayMchId,
    apiV3Key: serverEnv.wechatPayApiV3Key,
    merchantSerialNo: serverEnv.wechatPayMerchantSerialNo,
    merchantPrivateKeyPem: readFileSync(
      serverEnv.wechatPayMerchantPrivateKeyPath,
      "utf8",
    ),
    wechatPayPublicKeyId: serverEnv.wechatPayPublicKeyId,
    wechatPayPublicKeyPem: readFileSync(
      serverEnv.wechatPayPublicKeyPath,
      "utf8",
    ),
    notifyUrl: serverEnv.wechatPayNotifyUrl,
    refundNotifyUrl: serverEnv.wechatPayRefundNotifyUrl,
  });
}

export function createConfiguredLegacyZpayGateway() {
  return createZpayGateway({
    merchantId: serverEnv.zpayMerchantId,
    key: serverEnv.zpayKey,
    notifyUrl: serverEnv.zpayNotifyUrl,
    returnUrl: serverEnv.zpayReturnUrl,
    endpoint: process.env.ZPAY_CREATE_ENDPOINT,
    orderQueryEndpoint: process.env.ZPAY_ORDER_QUERY_ENDPOINT,
  });
}
