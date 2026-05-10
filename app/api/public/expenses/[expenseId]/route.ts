import { NextResponse } from "next/server";

import { getExpenseDetail } from "@/src/application/public";

export async function GET(
  _request: Request,
  context: { params: Promise<{ expenseId: string }> },
) {
  const { expenseId } = await context.params;
  const detail = await getExpenseDetail(expenseId);

  if (!detail) {
    return NextResponse.json(
      { message: `Expense ${expenseId} was not found.` },
      { status: 404 },
    );
  }

  return NextResponse.json(detail);
}
