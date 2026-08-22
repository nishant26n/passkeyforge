import { describe, expect, it } from "vitest";
import { generateSecret, generate, verify } from "otplib";

describe("TOTP", () => {
  it("generates a secret", () => {
    const secret = generateSecret();

    expect(secret).toBeTruthy();
    expect(typeof secret).toBe("string");
  });

  it("generates a valid OTP", async () => {
    const secret = generateSecret();

    const otp = await generate({
      secret,
    });

    expect(otp).toMatch(/^\d{6}$/);
  });

  it("verifies a valid OTP", async () => {
    const secret = generateSecret();

    const otp = await generate({
      secret,
    });

    const result = await verify({
      secret,
      token: otp,
    });

    expect(result.valid).toBe(true);
  });

  it("rejects an invalid OTP", async () => {
    const secret = generateSecret();

    const result = await verify({
      secret,
      token: "000000",
    });

    expect(result.valid).toBe(false);
  });
});
