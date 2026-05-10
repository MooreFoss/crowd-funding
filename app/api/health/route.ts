import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function GET() {
  return placeholderResponse("health check", ["GET"], 200);
}
