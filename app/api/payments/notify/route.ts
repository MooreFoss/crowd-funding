import { NextResponse } from "next/server";

import {
  confirmPaymentNotification,
  createConfiguredPaymentGateway,
} from "@/src/application/payments";

function readSearchPayload(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

async function readRequestPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await request.json().catch(() => ({}));
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return readSearchPayload(request);
}

async function handleNotification(request: Request) {
  const payload = await readRequestPayload(request);
  const normalizedPayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, String(value)]),
  );
  const gateway = createConfiguredPaymentGateway();

  if (!gateway.verifyNotification(normalizedPayload)) {
    return new NextResponse("fail", { status: 400 });
  }

  if (normalizedPayload.out_trade_no && normalizedPayload.trade_status === "TRADE_SUCCESS") {
    await confirmPaymentNotification({
      merchantOrderNo: normalizedPayload.out_trade_no,
      providerOrderNo: normalizedPayload.trade_no ?? null,
      paid: true,
    });
  }

  return new NextResponse("success", { status: 200 });
}

export function GET(request: Request) {
  return handleNotification(request);
}

export function POST(request: Request) {
  return handleNotification(request);
}
