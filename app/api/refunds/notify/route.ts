import { NextResponse } from "next/server";

import { createConfiguredPaymentGateway } from "@/src/application/payments";
import { confirmRefundNotification } from "@/src/application/refunds";
import type { RefundStatus } from "@/src/domain/refunds";

function mapWechatRefundStatus(rawStatus: unknown): RefundStatus {
  const status = String(rawStatus ?? "").toUpperCase();

  if (status === "SUCCESS") {
    return "SUCCEEDED";
  }

  if (status === "CLOSED") {
    return "REFUND_CLOSED";
  }

  if (status === "PROCESSING" || status === "ABNORMAL") {
    return "PROCESSING";
  }

  return "EXCEPTION";
}

export async function POST(request: Request) {
  const body = await request.text();
  const gateway = createConfiguredPaymentGateway();

  try {
    const notification = await gateway.verifyAndDecryptNotification({
      body,
      headers: request.headers,
    });
    const resource = notification.resource;
    const merchantRefundNo = resource.out_refund_no;

    if (typeof merchantRefundNo !== "string" || !merchantRefundNo) {
      return NextResponse.json(
        {
          error: "Refund notification is missing out_refund_no.",
        },
        { status: 400 },
      );
    }

    const refund = await confirmRefundNotification({
      merchantRefundNo,
      providerRefundNo:
        typeof resource.refund_id === "string" ? resource.refund_id : null,
      status: mapWechatRefundStatus(resource.refund_status),
    });

    return NextResponse.json({
      ok: true,
      refund,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid WeChat Pay refund notification signature.",
      },
      { status: 400 },
    );
  }
}
