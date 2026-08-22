import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { describe, expect, it } from "vitest";

describe("auth rate limiting", () => {
  it("allows requests below the limit", async () => {
    const email = `test-${Date.now()}@example.com`;
    const ip = `192.0.2.${Math.floor(Math.random() * 255)}`;

    const result = await checkAuthRateLimit("login", email, ip);

    expect(result.allowed).toBe(true);
  });

  it("limits repeated requests for the same email", async () => {
    const email = `bruteforce-${Date.now()}@example.com`;
    const ip = `192.0.2.${Math.floor(Math.random() * 255)}`;

    let lastResult;

    for (let i = 0; i < 6; i++) {
      lastResult = await checkAuthRateLimit("login", email, ip);
    }

    expect(lastResult?.allowed).toBe(false);
    expect(lastResult?.emailLimit.allowed).toBe(false);
  });
});
