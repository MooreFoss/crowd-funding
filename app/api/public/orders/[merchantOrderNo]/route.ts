import { NextResponse } from "next/server";

import {
  createConfiguredPaymentGateway,
  refreshSponsorOrderStatus,
} from "@/src/application/payments";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ merchantOrderNo: string }>;
  },
) {
  const { merchantOrderNo } = await context.params;
  const order = await refreshSponsorOrderStatus(
    {
      merchantOrderNo,
      gateway: createConfiguredPaymentGateway(),
    },
  );

  if (!order) {
    return NextResponse.json(
      {
        error: "Sponsor order was not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(order);
}
