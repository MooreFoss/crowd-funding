import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("admin session lookup", ["GET"]);
}

export function POST() {
  return placeholderResponse("admin authentication", ["POST"]);
}

export function DELETE() {
  return placeholderResponse("admin logout", ["DELETE"]);
}
