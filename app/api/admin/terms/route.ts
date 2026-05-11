import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createDraftTermsVersion,
  listTermsVersions,
  publishTermsVersion,
} from "@/src/application/admin";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";
import { redirectToRequestHost } from "@/src/server/http/redirect";

const createTermsSchema = z.object({
  version: z.string().trim().min(1),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

const publishTermsSchema = z.object({
  id: z.string().trim().min(1),
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

  return NextResponse.json(await listTermsVersions());
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return createUnauthorizedResponse();
  }

  const { kind, payload } = await readRequestPayload(request);
  const intent =
    typeof payload.intent === "string" ? payload.intent : undefined;

  if (intent === "publish") {
    const parsedPublish = publishTermsSchema.safeParse(payload);

    if (!parsedPublish.success) {
      return kind === "form"
        ? redirectToRequestHost(request, "/admin/terms?error=invalid-request")
        : NextResponse.json(
            {
              error: "Terms version id is required.",
            },
            { status: 400 },
          );
    }

    const published = await publishTermsVersion({
      id: parsedPublish.data.id,
    });

    return kind === "form"
      ? redirectToRequestHost(request, "/admin/terms")
      : NextResponse.json(published);
  }

  const parsedCreate = createTermsSchema.safeParse(payload);

  if (!parsedCreate.success) {
    return kind === "form"
      ? redirectToRequestHost(request, "/admin/terms?error=invalid-request")
      : NextResponse.json(
          {
            error: "Version, title, and body are required.",
          },
          { status: 400 },
        );
  }

  const created = await createDraftTermsVersion({
    ...parsedCreate.data,
    createdBy: session.username,
  });

  return kind === "form"
    ? redirectToRequestHost(request, "/admin/terms")
    : NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return createUnauthorizedResponse();
  }

  const { payload } = await readRequestPayload(request);
  const parsed = publishTermsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Terms version id is required.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await publishTermsVersion({
      id: parsed.data.id,
    }),
  );
}
