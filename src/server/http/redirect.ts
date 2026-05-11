import { NextResponse } from "next/server";

function getRequestOrigin(request: Request) {
  const fallbackUrl = new URL(request.url);
  const host = request.headers.get("host") ?? fallbackUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ?? fallbackUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

export function requestHostUrl(request: Request, path: string) {
  return new URL(path, getRequestOrigin(request));
}

export function redirectToRequestHost(
  request: Request,
  path: string,
  status: 303 | 307 | 308 = 303,
) {
  return NextResponse.redirect(requestHostUrl(request, path), status);
}
