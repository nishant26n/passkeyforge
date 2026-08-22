import { describe, expect, it } from "vitest";
import { prisma } from "@/app/lib/prisma";
import {
  generateRecoveryCode,
  hashRecoveryCode,
} from "@/app/lib/auth/recovery-code";

describe("recovery code database lifecycle", () => {
  it("stores only the hash, not the actual recovery code", async () => {
    const user = await prisma.user.create({
      data: {
        email: `recovery-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });

    const code = generateRecoveryCode();

    await prisma.recoveryCode.create({
      data: {
        codeHash: hashRecoveryCode(code),
        userId: user.id,
      },
    });

    const record = await prisma.recoveryCode.findFirst({
      where: {
        userId: user.id,
      },
    });

    expect(record).not.toBeNull();
    expect(record?.codeHash).toBe(hashRecoveryCode(code));
    expect(record?.codeHash).not.toBe(code);

    await prisma.recoveryCode.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  });

  it("marks a recovery code as used", async () => {
    const user = await prisma.user.create({
      data: {
        email: `recovery-used-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });

    const code = generateRecoveryCode();

    const record = await prisma.recoveryCode.create({
      data: {
        codeHash: hashRecoveryCode(code),
        userId: user.id,
      },
    });

    expect(record.usedAt).toBeNull();

    const usedAt = new Date();

    await prisma.recoveryCode.update({
      where: {
        id: record.id,
      },
      data: {
        usedAt,
      },
    });

    const updated = await prisma.recoveryCode.findUnique({
      where: {
        id: record.id,
      },
    });

    expect(updated?.usedAt).not.toBeNull();

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  });
});
