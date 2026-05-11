import { NextResponse } from "next/server";
import { z } from "zod";

import { closeCampaign } from "@/src/application/refunds";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";
import { redirectToRequestHost } from "@/src/server/http/redirect";

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
      : redirectToRequestHost(request, "/admin/refunds?error=close-reason-required");
  }

  const state = await closeCampaign({
    closeReason: parsed.data.closeReason,
    closedBy: session.username,
  });

  return contentType.includes("application/json")
    ? NextResponse.json(state)
    : redirectToRequestHost(request, "/admin/refunds");
}
