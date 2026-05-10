import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("admin terms query", ["GET"]);
}

export function POST() {
  return placeholderResponse("admin terms version creation", ["POST"]);
}

export function PATCH() {
  return placeholderResponse("admin terms version update", ["PATCH"]);
}
