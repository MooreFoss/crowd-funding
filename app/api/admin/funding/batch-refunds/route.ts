import { NextResponse } from "next/server";

import { createBatchRefund } from "@/src/application/refunds";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      {
        error: "Admin session is required.",
      },
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const result = await createBatchRefund({
    requestedBy: session.username,
  });

  return contentType.includes("application/json")
    ? NextResponse.json(result, { status: 201 })
    : NextResponse.redirect(new URL("/admin/refunds", request.url), 303);
}
