import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("active public terms", ["GET"]);
}
