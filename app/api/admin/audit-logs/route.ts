import { NextResponse } from "next/server";

import { listAuditLogs } from "@/src/application/admin";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      {
        error: "Admin session is required.",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);

  return NextResponse.json(
    await listAuditLogs({
      action: url.searchParams.get("action"),
      targetType: url.searchParams.get("targetType"),
      targetId: url.searchParams.get("targetId"),
      limit: Number(url.searchParams.get("limit") ?? "100"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    }),
  );
}
