import { NextResponse } from "next/server";

import { exchangeMiniProgramLoginCode } from "@/src/application/wechat";

async function readCode(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };

  return typeof body.code === "string" ? body.code : "";
}

export async function POST(request: Request) {
  try {
    const session = await exchangeMiniProgramLoginCode({
      code: await readCode(request),
    });

    return NextResponse.json({
      ok: true,
      unionid: session.unionid,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to exchange wx.login code.",
      },
      { status: 400 },
    );
  }
}
