import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createConfiguredPaymentGateway,
  createSponsorOrder,
  LAST_SPONSOR_ORDER_COOKIE_NAME,
  SPONSOR_USER_KEY_COOKIE_NAME,
} from "@/src/application/payments";
import { redirectToRequestHost } from "@/src/server/http/redirect";

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((allCookies, cookieEntry) => {
    const separatorIndex = cookieEntry.indexOf("=");

    if (separatorIndex === -1) {
      return allCookies;
    }

    const name = cookieEntry.slice(0, separatorIndex).trim();
    const value = cookieEntry.slice(separatorIndex + 1).trim();

    allCookies[name] = value;
    return allCookies;
  }, {});
}

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

function readClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

function normalizeSponsorPayload(
  payload: Record<string, FormDataEntryValue | unknown>,
  userKey: string,
  request: Request,
) {
  const amountValue =
    typeof payload.amount === "string" ? payload.amount : "";
  const displayName =
    typeof payload.displayName === "string"
      ? payload.displayName
      : typeof payload.nickname === "string"
        ? payload.nickname
        : "";
  const message =
    typeof payload.message === "string" ? payload.message : "";
  const termsAccepted =
    payload.termsAccepted === true ||
    payload.termsAccepted === "true" ||
    payload.termsAccepted === "on";

  return {
    amount: amountValue,
    displayName,
    message,
    termsAccepted,
    userKey,
    clientIp: readClientIp(request),
    userAgent: request.headers.get("user-agent") ?? "",
  };
}

function applySponsorCookies(response: NextResponse, userKey: string, merchantOrderNo: string) {
  response.cookies.set({
    name: SPONSOR_USER_KEY_COOKIE_NAME,
    value: userKey,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set({
    name: LAST_SPONSOR_ORDER_COOKIE_NAME,
    value: merchantOrderNo,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function POST(request: Request) {
  const { kind, payload } = await readRequestPayload(request);
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const userKey = cookies[SPONSOR_USER_KEY_COOKIE_NAME] ?? randomUUID();

  try {
    const order = await createSponsorOrder(
      normalizeSponsorPayload(payload, userKey, request),
      {
        gateway: createConfiguredPaymentGateway(),
      },
    );

    const response =
      kind === "form"
        ? NextResponse.redirect(order.paymentRedirectUrl!, 303)
        : NextResponse.json(order, { status: 201 });

    applySponsorCookies(response, userKey, order.merchantOrderNo);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create sponsor order.";

    return kind === "form"
      ? redirectToRequestHost(
          request,
          `/sponsor?error=${encodeURIComponent(message)}`,
        )
      : NextResponse.json(
          {
            error: message,
          },
          { status: 400 },
        );
  }
}
