import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function POST() {
  return placeholderResponse("create sponsorship order", ["POST"]);
}
