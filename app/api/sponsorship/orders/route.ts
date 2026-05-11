import { NextResponse } from "next/server";

import { redirectToRequestHost } from "@/src/server/http/redirect";

const RETIRED_ENDPOINT_MESSAGE =
  "Legacy H5 payment endpoint has been retired. Use /api/sponsorship/native-orders for desktop web payment or the mini program route for JSAPI payment.";

async function isFormRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

export async function POST(request: Request) {
  if (await isFormRequest(request)) {
    return redirectToRequestHost(request, "/sponsor/mini-program-jump", 303);
  }

  return NextResponse.json(
    {
      error: RETIRED_ENDPOINT_MESSAGE,
    },
    { status: 410 },
  );
}
