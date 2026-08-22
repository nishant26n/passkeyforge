import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/app/lib/auth/register";

describe("password hashing", () => {
  it("hashes a password and verifies the original password", async () => {
    const password = "CorrectPassword123!";

    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const password = "CorrectPassword123!";

    const hash = await hashPassword(password);

    expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
  });
});
