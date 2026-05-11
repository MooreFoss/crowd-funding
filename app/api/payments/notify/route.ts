import { NextResponse } from "next/server";

import {
  confirmPaymentNotification,
  createConfiguredPaymentGateway,
} from "@/src/application/payments";

export async function POST(request: Request) {
  const body = await request.text();
  const gateway = createConfiguredPaymentGateway();

  try {
    const notification = await gateway.verifyAndDecryptNotification({
      body,
      headers: request.headers,
    });
    const resource = notification.resource;

    if (
      notification.eventType === "TRANSACTION.SUCCESS" &&
      resource.trade_state === "SUCCESS" &&
      typeof resource.out_trade_no === "string"
    ) {
      await confirmPaymentNotification({
        merchantOrderNo: resource.out_trade_no,
        providerOrderNo:
          typeof resource.transaction_id === "string"
            ? resource.transaction_id
            : null,
        paid: true,
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid WeChat Pay notification signature.",
      },
      { status: 400 },
    );
  }
}
