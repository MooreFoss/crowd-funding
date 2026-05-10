import { NextResponse } from "next/server";

import { getSummary } from "@/src/application/public";

export async function GET() {
  const summary = await getSummary();

  return NextResponse.json(summary);
}
