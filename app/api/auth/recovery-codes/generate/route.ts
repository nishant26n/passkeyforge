import { createHash, randomBytes } from "crypto";
import { getCurrentUser } from "@/app/lib/auth/current-user";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

function generateRecoveryCode() {
  const value = randomBytes(6).toString("hex").toUpperCase();
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
}

function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const codes = Array.from({ length: 10 }).map(() => generateRecoveryCode());

    const codeRecords = codes.map((code) => ({
      codeHash: hashRecoveryCode(code),
      userId: user.id,
    }));

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Regenrating codes invalidates the previous set.
      await tx.recoveryCode.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      await tx.recoveryCode.createMany({
        data: codeRecords,
      });
    });

    return NextResponse.json({ codes });
  } catch (error) {
    console.error("Recovery code generation error:", error);

    return NextResponse.json(
      { error: "Failed to generate recovery codes" },
      { status: 500 },
    );
  }
}
