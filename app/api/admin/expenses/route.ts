import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("admin expense query", ["GET"]);
}

export function POST() {
  return placeholderResponse("admin expense creation", ["POST"]);
}

export function PATCH() {
  return placeholderResponse("admin expense update", ["PATCH"]);
}
