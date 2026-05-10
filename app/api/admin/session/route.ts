import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminAuthenticationState,
  loginAdmin,
} from "@/src/application/admin";
import {
  clearAdminSessionCookie,
  getAdminSessionFromRequest,
  setAdminSessionCookie,
} from "@/src/infrastructure/auth/session";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
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

export function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);

  return NextResponse.json(getAdminAuthenticationState(session));
}

export async function POST(request: Request) {
  const { kind, payload } = await readRequestPayload(request);
  const intent =
    typeof payload.intent === "string" ? payload.intent : undefined;

  if (intent === "logout") {
    const response =
      kind === "form"
        ? NextResponse.redirect(new URL("/admin", request.url), 303)
        : NextResponse.json({ authenticated: false, username: null });

    clearAdminSessionCookie(response);
    return response;
  }

  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return kind === "form"
      ? NextResponse.redirect(
          new URL("/admin?error=invalid-request", request.url),
          303,
        )
      : NextResponse.json(
          {
            authenticated: false,
            username: null,
            error: "Invalid login payload.",
          },
          { status: 400 },
        );
  }

  const authentication = loginAdmin(parsed.data);

  if (!authentication.authenticated || !authentication.username) {
    return kind === "form"
      ? NextResponse.redirect(
          new URL("/admin?error=invalid-credentials", request.url),
          303,
        )
      : NextResponse.json(
          {
            authenticated: false,
            username: null,
            error: "Invalid admin credentials.",
          },
          { status: 401 },
        );
  }

  const response =
    kind === "form"
      ? NextResponse.redirect(new URL("/admin", request.url), 303)
      : NextResponse.json(authentication);

  setAdminSessionCookie(response, authentication.username);
  return response;
}

export function DELETE() {
  const response = NextResponse.json({
    authenticated: false,
    username: null,
  });

  clearAdminSessionCookie(response);
  return response;
}
