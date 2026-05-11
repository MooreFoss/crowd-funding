import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createConfiguredPaymentGateway,
  createSponsorOrder,
  LAST_SPONSOR_ORDER_COOKIE_NAME,
  SPONSOR_USER_KEY_COOKIE_NAME,
} from "@/src/application/payments";
import { exchangeMiniProgramLoginCode } from "@/src/application/wechat";

function readClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((allCookies, cookieEntry) => {
    const separatorIndex = cookieEntry.indexOf("=");

    if (separatorIndex === -1) {
      return allCookies;
    }

    allCookies[cookieEntry.slice(0, separatorIndex).trim()] = cookieEntry
      .slice(separatorIndex + 1)
      .trim();
    return allCookies;
  }, {});
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
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof payload.code === "string" ? payload.code : "";
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const userKey = cookies[SPONSOR_USER_KEY_COOKIE_NAME] ?? randomUUID();

  try {
    const session = await exchangeMiniProgramLoginCode({ code });
    const order = await createSponsorOrder(
      {
        mode: "MINI_PROGRAM_JSAPI",
        amount: typeof payload.amount === "string" ? payload.amount : "",
        displayName:
          typeof payload.displayName === "string" ? payload.displayName : "",
        message: typeof payload.message === "string" ? payload.message : "",
        termsAccepted: payload.termsAccepted === true,
        userKey,
        clientIp: readClientIp(request),
        userAgent: request.headers.get("user-agent") ?? "WeChat Mini Program",
        openid: session.openid,
      },
      {
        gateway: createConfiguredPaymentGateway(),
      },
    );
    const response = NextResponse.json(order, { status: 201 });

    applySponsorCookies(response, userKey, order.merchantOrderNo);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create mini program sponsor order.",
      },
      { status: 400 },
    );
  }
}
