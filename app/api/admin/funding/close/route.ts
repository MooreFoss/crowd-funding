import { NextResponse } from "next/server";
import { z } from "zod";

import { closeCampaign } from "@/src/application/refunds";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";

const closeSchema = z.object({
  closeReason: z.string().trim().min(1),
});

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
  const payload = contentType.includes("application/json")
    ? await request.json().catch(() => ({}))
    : Object.fromEntries((await request.formData()).entries());
  const parsed = closeSchema.safeParse(payload);

  if (!parsed.success) {
    return contentType.includes("application/json")
      ? NextResponse.json(
          {
            error: "Close reason is required.",
          },
          { status: 400 },
        )
      : NextResponse.redirect(
          new URL("/admin/refunds?error=close-reason-required", request.url),
          303,
        );
  }

  const state = await closeCampaign({
    closeReason: parsed.data.closeReason,
    closedBy: session.username,
  });

  return contentType.includes("application/json")
    ? NextResponse.json(state)
    : NextResponse.redirect(new URL("/admin/refunds", request.url), 303);
}
