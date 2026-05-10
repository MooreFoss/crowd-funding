import { NextResponse } from "next/server";
import { z } from "zod";

import { createExpenseEvidenceUploadTarget } from "@/src/application/admin";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";

const uploadTargetSchema = z.object({
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1).default("application/octet-stream"),
  prefix: z.string().trim().min(1).optional(),
  expiresInSeconds: z.coerce.number().int().min(60).max(3600).optional(),
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

  const payload = await request.json().catch(() => ({}));
  const parsed = uploadTargetSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "File name and content type are required.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(createExpenseEvidenceUploadTarget(parsed.data));
}
