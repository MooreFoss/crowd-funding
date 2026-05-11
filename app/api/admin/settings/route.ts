import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getEditableSiteSettings,
  updateEditableSiteSettings,
} from "@/src/application/admin";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";
import { redirectToRequestHost } from "@/src/server/http/redirect";

const settingsSchema = z.object({
  siteTitle: z.string().trim().min(1),
  faviconUrl: z.string().trim().min(1),
  heroTitle: z.string().trim().min(1),
  heroDescription: z.string().trim().min(1),
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

  return NextResponse.json(await getEditableSiteSettings());
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return unauthorized();
  }

  const { kind, payload } = await readRequestPayload(request);
  const parsed = settingsSchema.safeParse(payload);

  if (!parsed.success) {
    return kind === "form"
      ? redirectToRequestHost(request, "/admin/settings?error=invalid-request")
      : NextResponse.json(
          {
            error:
              "Site title, favicon URL, hero title, and hero description are required.",
          },
          { status: 400 },
        );
  }

  try {
    const settings = await updateEditableSiteSettings({
      ...parsed.data,
      updatedBy: session.username,
    });

    return kind === "form"
      ? redirectToRequestHost(request, "/admin/settings?saved=1")
      : NextResponse.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings.";

    return kind === "form"
      ? redirectToRequestHost(
          request,
          `/admin/settings?error=${encodeURIComponent(message)}`,
        )
      : NextResponse.json(
          {
            error: message,
          },
          { status: 400 },
        );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
