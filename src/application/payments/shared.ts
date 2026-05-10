import { serverEnv } from "@/src/config/env";
import { createZpayGateway } from "@/src/infrastructure/payments";

export const SPONSOR_USER_KEY_COOKIE_NAME = "cf_sponsor_user";
export const LAST_SPONSOR_ORDER_COOKIE_NAME = "cf_last_sponsor_order";

export function createConfiguredPaymentGateway() {
  return createZpayGateway({
    merchantId: serverEnv.zpayMerchantId,
    key: serverEnv.zpayKey,
    notifyUrl: serverEnv.zpayNotifyUrl,
    returnUrl: serverEnv.zpayReturnUrl,
    endpoint: process.env.ZPAY_CREATE_ENDPOINT,
    orderQueryEndpoint: process.env.ZPAY_ORDER_QUERY_ENDPOINT,
  });
}
