import { getCurrentUser } from "@/app/lib/auth/current-user";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  generateRecoveryCode,
  hashRecoveryCode,
} from "@/app/lib/auth/recovery-code";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";

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

    const rateLimit = await checkAuthRateLimit(
      "recovery-codes-generate",
      user.id,
      "recovery",
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
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
