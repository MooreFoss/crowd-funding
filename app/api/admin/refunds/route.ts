import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("admin refund query", ["GET"]);
}

export function POST() {
  return placeholderResponse("admin refund request", ["POST"]);
}
