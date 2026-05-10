import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { serverEnv } from "@/src/config/env";

export const ADMIN_SESSION_COOKIE_NAME = "cf_admin_session";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type AdminSession = {
  username: string;
  issuedAt: string;
};

function hashSha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", serverEnv.sessionSecret)
    .update(payload)
    .digest("base64url");
}

function encodeSessionPayload(session: AdminSession) {
  const payload = JSON.stringify(session);
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = signSessionPayload(payload);

  return `${encodedPayload}.${signature}`;
}

function decodeSessionToken(token: string): AdminSession | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  let payload: string;

  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSignature = signSessionPayload(payload);

  if (!safeEqualText(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<AdminSession>;

    if (
      typeof parsed.username !== "string" ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }

    if (!safeEqualText(parsed.username, serverEnv.adminUsername)) {
      return null;
    }

    return {
      username: parsed.username,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((allCookies, entry) => {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex === -1) {
      return allCookies;
    }

    const name = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();

    allCookies[name] = value;
    return allCookies;
  }, {});
}

export function verifyAdminCredentials(input: {
  username: string;
  password: string;
}) {
  if (!safeEqualText(input.username, serverEnv.adminUsername)) {
    return false;
  }

  const configuredHash = serverEnv.adminPasswordHash.trim();
  const passwordHash = hashSha256(input.password);

  if (configuredHash.startsWith("sha256:")) {
    return safeEqualText(passwordHash, configuredHash.slice("sha256:".length));
  }

  if (/^[a-f0-9]{64}$/i.test(configuredHash)) {
    return safeEqualText(passwordHash, configuredHash);
  }

  return safeEqualText(input.password, configuredHash);
}

export function getAdminSessionFromCookieHeader(cookieHeader: string | null) {
  const parsedCookies = parseCookieHeader(cookieHeader);
  const token = parsedCookies[ADMIN_SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  return decodeSessionToken(token);
}

export function getAdminSessionFromRequest(request: Request) {
  return getAdminSessionFromCookieHeader(request.headers.get("cookie"));
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return decodeSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? "",
  );
}

export async function requireAdminPageSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin");
  }

  return session;
}

export function setAdminSessionCookie(
  response: NextResponse,
  username: string,
) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: encodeSessionPayload({
      username,
      issuedAt: new Date().toISOString(),
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
