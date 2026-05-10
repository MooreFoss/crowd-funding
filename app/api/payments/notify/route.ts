import { placeholderResponse } from "@/src/server/http/placeholderResponse";

export function POST() {
  return placeholderResponse("payment notification callback", ["POST"]);
}
