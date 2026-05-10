import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addAdminExpenseEvidence,
  createAdminExpense,
  listAdminExpenses,
  updateAdminExpense,
  updateAdminExpenseEvidence,
} from "@/src/application/admin";
import { getAdminSessionFromRequest } from "@/src/infrastructure/auth/session";

const visibilitySchema = z.enum(["PUBLIC", "AUDIT_ONLY"]);

const evidenceSchema = z.object({
  assetUrl: z.string().trim().url(),
  fileName: z.string().trim().min(1),
  label: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  visibility: visibilitySchema.optional(),
});

const expenseSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  amount: z.string().trim().min(1),
  description: z.string().trim().default(""),
  detailVisibility: visibilitySchema.default("PUBLIC"),
  evidence: z.array(evidenceSchema).optional(),
});

const addEvidenceSchema = evidenceSchema.extend({
  expenseId: z.string().trim().min(1),
});

const updateEvidenceSchema = z.object({
  id: z.string().trim().min(1),
  assetUrl: z.string().trim().url().optional(),
  fileName: z.string().trim().min(1).optional(),
  label: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0),
  visibility: visibilitySchema,
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

function redirectWithError(request: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/admin/expenses?error=${encodeURIComponent(message)}`, request.url),
    303,
  );
}

function normalizeFormEvidence(payload: Record<string, unknown>) {
  const assetUrl = typeof payload.assetUrl === "string" ? payload.assetUrl.trim() : "";
  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";

  if (!assetUrl || !fileName) {
    return [];
  }

  return [
    {
      assetUrl,
      fileName,
      label: typeof payload.label === "string" ? payload.label : "",
      sortOrder: Number(payload.sortOrder ?? 1),
      visibility: payload.visibility === "AUDIT_ONLY" ? "AUDIT_ONLY" : "PUBLIC",
    },
  ];
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return createUnauthorizedResponse();
  }

  return NextResponse.json(await listAdminExpenses());
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);

  if (!session) {
    return createUnauthorizedResponse();
  }

  const { kind, payload } = await readRequestPayload(request);
  const intent = typeof payload.intent === "string" ? payload.intent : "create";

  try {
    if (intent === "add-evidence") {
      const parsed = addEvidenceSchema.parse(payload);
      const created = await addAdminExpenseEvidence({
        ...parsed,
        uploadedBy: session.username,
      });

      return kind === "form"
        ? NextResponse.redirect(new URL("/admin/expenses", request.url), 303)
        : NextResponse.json(created, { status: 201 });
    }

    if (intent === "update-evidence") {
      const parsed = updateEvidenceSchema.parse(payload);
      const updated = await updateAdminExpenseEvidence(parsed);

      return kind === "form"
        ? NextResponse.redirect(new URL("/admin/expenses", request.url), 303)
        : NextResponse.json(updated);
    }

    if (intent === "update-expense") {
      const parsed = expenseSchema.required({ id: true }).parse({
        ...payload,
        evidence: normalizeFormEvidence(payload),
      });
      const updated = await updateAdminExpense(parsed);

      return kind === "form"
        ? NextResponse.redirect(new URL("/admin/expenses", request.url), 303)
        : NextResponse.json(updated);
    }

    const parsed = expenseSchema.parse({
      ...payload,
      evidence:
        Array.isArray(payload.evidence) || kind === "json"
          ? payload.evidence
          : normalizeFormEvidence(payload),
    });
    const created = await createAdminExpense({
      ...parsed,
      createdBy: session.username,
    });

    return kind === "form"
      ? NextResponse.redirect(new URL("/admin/expenses", request.url), 303)
      : NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save expense.";

    return kind === "form"
      ? redirectWithError(request, message)
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
