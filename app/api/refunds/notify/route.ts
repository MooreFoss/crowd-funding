import { NextResponse } from "next/server";

import { createConfiguredPaymentGateway } from "@/src/application/payments";
import { confirmRefundNotification } from "@/src/application/refunds";
import type { RefundStatus } from "@/src/domain/refunds";

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as Record<string, string>;
  }

  return Object.fromEntries((await request.formData()).entries()) as Record<string, string>;
}

function readRefundStatus(payload: Record<string, string>): RefundStatus {
  const rawStatus = String(
    payload.refund_status ?? payload.status ?? payload.trade_status ?? "",
  ).toUpperCase();

  if (["SUCCESS", "SUCCEEDED", "1", "REFUND_SUCCESS"].includes(rawStatus)) {
    return "SUCCEEDED";
  }

  if (["CLOSED", "REFUND_CLOSED"].includes(rawStatus)) {
    return "REFUND_CLOSED";
  }

  if (["PROCESSING", "0"].includes(rawStatus)) {
    return "PROCESSING";
  }

  return "EXCEPTION";
}

export async function POST(request: Request) {
  const payload = await readPayload(request);
  const gateway = createConfiguredPaymentGateway();

  if (!gateway.verifyNotification(payload)) {
    return NextResponse.json(
      {
        error: "Invalid refund notification signature.",
      },
      { status: 400 },
    );
  }

  const merchantRefundNo =
    payload.refund_no ?? payload.out_refund_no ?? payload.merchant_refund_no;

  if (!merchantRefundNo) {
    return NextResponse.json(
      {
        error: "Refund notification is missing refund_no.",
      },
      { status: 400 },
    );
  }

  const refund = await confirmRefundNotification({
    merchantRefundNo,
    providerRefundNo:
      payload.trade_no ?? payload.provider_refund_no ?? payload.refund_id ?? null,
    status: readRefundStatus(payload),
  });

  return NextResponse.json({
    ok: true,
    refund,
  });
}
