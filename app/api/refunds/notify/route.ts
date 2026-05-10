import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function POST() {
  return placeholderResponse("refund notification callback", ["POST"]);
}
