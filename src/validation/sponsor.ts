import { z } from "zod";

import { parseMoneyToFen } from "@/src/shared";

const sponsorSchema = z.object({
  amount: z.string().trim().min(1, "Amount is required."),
  displayName: z.string().max(20, "Display name must be at most 20 characters."),
  message: z.string().max(200, "Message must be at most 200 characters."),
  termsAccepted: z.boolean(),
  userKey: z.string().trim().min(1, "User key is required."),
  clientIp: z.string().trim().min(1, "Client IP is required."),
  userAgent: z.string().trim().optional().default(""),
});

export type SponsorSubmission = {
  amountFen: number;
  displayName: string | null;
  publicDisplayName: string;
  message: string | null;
  termsAccepted: true;
  userKey: string;
  clientIp: string;
  userAgent: string;
};

export function validateSponsorSubmission(input: unknown): SponsorSubmission {
  const parsed = sponsorSchema.parse(input);
  const amountFen = parseMoneyToFen(parsed.amount);

  if (amountFen <= 0) {
    throw new Error("Sponsor amount must be greater than zero.");
  }

  if (!parsed.termsAccepted) {
    throw new Error("Terms acceptance is required.");
  }

  const normalizedDisplayName = parsed.displayName.trim();
  const normalizedMessage = parsed.message.trim();
  const submittedDisplayName =
    normalizedDisplayName.length > 0 ? normalizedDisplayName : null;
  const submittedMessage =
    normalizedMessage.length > 0 ? normalizedMessage : null;

  return {
    amountFen,
    displayName: submittedDisplayName,
    publicDisplayName: submittedDisplayName ?? "匿名用户",
    message: submittedMessage,
    termsAccepted: true,
    userKey: parsed.userKey,
    clientIp: parsed.clientIp,
    userAgent: parsed.userAgent,
  };
}
