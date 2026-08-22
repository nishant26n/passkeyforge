import {
  generateRecoveryCode,
  hashRecoveryCode,
} from "@/app/lib/auth/recovery-code";
import { describe, expect, it } from "vitest";

describe("recovery codes", () => {
  it("generates a recovery code in the expected format", () => {
    const code = generateRecoveryCode();

    expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it("generates different recovery codes", () => {
    const first = generateRecoveryCode();
    const second = generateRecoveryCode();

    expect(first).not.toBe(second);
  });

  it("hashes the same recovery code consistently", () => {
    const code = "ABCD-1234-EFGH";

    const firstHash = hashRecoveryCode(code);
    const secondHash = hashRecoveryCode(code);

    expect(firstHash).toBe(secondHash);
  });

  it("does not store the recovery code itself in the hash", () => {
    const code = "ABCD-1234-EFGH";

    const hash = hashRecoveryCode(code);

    expect(hash).not.toContain(code);
    expect(hash).toHaveLength(64);
  });
});
