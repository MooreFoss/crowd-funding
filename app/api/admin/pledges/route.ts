import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listAdminPledges,
  reviewEditedPledgeText,
} from "@/src/application/admin";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";
import { redirectToRequestHost } from "@/src/server/http/redirect";

const editPledgeSchema = z.object({
  id: z.string().trim().min(1),
  displayName: z.string().max(20).nullable().optional(),
  publicName: z.string().max(20).nullable().optional(),
  nickname: z.string().max(20).nullable().optional(),
  message: z.string().max(200).nullable().optional(),
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

function createUnauthorizedResponse() {
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
    return createUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  return NextResponse.json(
    await listAdminPledges({
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
      offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
    }),
  );
}

export async function PATCH(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return createUnauthorizedResponse();
  }

  const { kind, payload } = await readRequestPayload(request);
  const parsed = editPledgeSchema.safeParse(payload);

  if (!parsed.success) {
    return kind === "form"
      ? redirectToRequestHost(request, "/admin/pledges?error=invalid-request")
      : NextResponse.json(
          {
            error: "Pledge id, display name, and message are required.",
          },
          { status: 400 },
        );
  }

  try {
    const updated = await reviewEditedPledgeText({
      pledgeId: parsed.data.id,
      displayName:
        parsed.data.displayName ??
        parsed.data.publicName ??
        parsed.data.nickname ??
        null,
      message: parsed.data.message ?? null,
    });

    return kind === "form"
      ? redirectToRequestHost(request, "/admin/pledges")
      : NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update pledge text.";

    return kind === "form"
      ? redirectToRequestHost(
          request,
          `/admin/pledges?error=${encodeURIComponent(message)}`,
        )
      : NextResponse.json(
          {
            error: message,
          },
          { status: 422 },
        );
  }
}

export async function POST(request: Request) {
  return PATCH(request);
}
