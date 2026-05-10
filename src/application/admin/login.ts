import type { AdminSession } from "@/src/infrastructure/auth/session";
import { verifyAdminCredentials } from "@/src/infrastructure/auth/session";

export type AdminAuthentication = {
  authenticated: boolean;
  username: string | null;
};

export type AdminLoginInput = {
  username: string;
  password: string;
};

export function getAdminAuthenticationState(
  session: AdminSession | null,
): AdminAuthentication {
  return {
    authenticated: session !== null,
    username: session?.username ?? null,
  };
}

export function loginAdmin(input: AdminLoginInput): AdminAuthentication {
  const authenticated = verifyAdminCredentials(input);

  return {
    authenticated,
    username: authenticated ? input.username : null,
  };
}
