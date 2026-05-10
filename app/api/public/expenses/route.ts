import { NextResponse } from "next/server";

import { listExpenses } from "@/src/application/public";

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const expenses = await listExpenses({
    limit: parsePositiveInteger(searchParams.get("limit"), 20),
    offset: parsePositiveInteger(searchParams.get("offset"), 0),
  });

  return NextResponse.json(expenses);
}
