import { NextResponse } from "next/server";

export function placeholderResponse(
  feature: string,
  methods: string[],
  status = 501,
) {
  return NextResponse.json(
    {
      feature,
      implemented: false,
      methods,
      message: "Endpoint scaffold only. Business logic is intentionally not implemented yet.",
    },
    { status },
  );
}
