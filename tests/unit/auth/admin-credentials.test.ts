import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyAdminCredentials } from "@/src/infrastructure/auth/session";

describe("admin credentials", () => {
  let originalAdminUsername: string | undefined;
  let originalAdminPassword: string | undefined;

  beforeEach(() => {
    originalAdminUsername = process.env.ADMIN_USERNAME;
    originalAdminPassword = process.env.ADMIN_PASSWORD;

    process.env.ADMIN_USERNAME = "test-admin";
    process.env.ADMIN_PASSWORD =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    if (originalAdminUsername === undefined) {
      delete process.env.ADMIN_USERNAME;
    } else {
      process.env.ADMIN_USERNAME = originalAdminUsername;
    }

    if (originalAdminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = originalAdminPassword;
    }
  });

  it("compares ADMIN_PASSWORD as plain text", () => {
    expect(
      verifyAdminCredentials({
        username: "test-admin",
        password:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    ).toBe(true);

    expect(
      verifyAdminCredentials({
        username: "test-admin",
        password: "wrong-password",
      }),
    ).toBe(false);
  });
});
