import { NextResponse } from "next/server";

import { getActiveTermsVersion } from "@/src/application/admin";

export async function GET() {
  const activeTerms = await getActiveTermsVersion();

  if (!activeTerms) {
    return NextResponse.json(
      {
        error: "No active terms version was found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(activeTerms);
}
