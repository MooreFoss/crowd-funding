import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("admin sponsorship query", ["GET"]);
}

export function PATCH() {
  return placeholderResponse("admin sponsorship display update", ["PATCH"]);
}
