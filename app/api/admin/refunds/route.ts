import { NextResponse } from "next/server";
import { z } from "zod";

import { createSingleRefund, listRefundCenter } from "@/src/application/refunds";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";
import { redirectToRequestHost } from "@/src/server/http/redirect";

const createRefundSchema = z.object({
  pledgeId: z.string().trim().min(1),
  amount: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

async function readRequestPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return {
      kind: "json" as const,
      payload: await request.json().catch(() => ({})),
    };
  }

  const formData = await request.formData();

  return {
    kind: "form" as const,
    payload: Object.fromEntries(formData.entries()),
  };
}

function unauthorized() {
  return NextResponse.json(
    {
      error: "Admin session is required.",
    },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return unauthorized();
  }

  return NextResponse.json(await listRefundCenter());
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return unauthorized();
  }

  const { kind, payload } = await readRequestPayload(request);
  const parsed = createRefundSchema.safeParse(payload);

  if (!parsed.success) {
    return kind === "form"
      ? redirectToRequestHost(request, "/admin/refunds?error=invalid-request")
      : NextResponse.json(
          {
            error: "Pledge, amount, and reason are required.",
          },
          { status: 400 },
        );
  }

  try {
    const refund = await createSingleRefund({
      ...parsed.data,
      requestedBy: session.username,
    });

    return kind === "form"
      ? redirectToRequestHost(request, "/admin/refunds")
      : NextResponse.json(refund, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create refund.";

    return kind === "form"
      ? redirectToRequestHost(
          request,
          `/admin/refunds?error=${encodeURIComponent(message)}`,
        )
      : NextResponse.json(
          {
            error: message,
          },
          { status: 400 },
        );
  }
}
