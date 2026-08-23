import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{
    credentialId: string;
  }>;
};

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate-limit credential revocation attempts.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit(
      "credential-delete",
      user.id,
      ip,
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

    const { credentialId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      // Make sure this credential belongs to the currently
      // authenticated user.
      const credential = await tx.credential.findFirst({
        where: {
          id: credentialId,
          userId: user.id,
        },
      });

      if (!credential) {
        return { error: "not_found" as const };
      }

      // Prevent the user from removing their only authentication
      // method when they don't have a password fallback.
      const credentialCount = await tx.credential.count({
        where: {
          userId: user.id,
        },
      });

      if (credentialCount <= 1 && !user.passwordHash) {
        return { error: "last_method" as const };
      }

      await tx.credential.delete({
        where: {
          id: credential.id,
        },
      });

      return { success: true as const };
    });

    if (result.error === "not_found") {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 },
      );
    }

    if (result.error === "last_method") {
      return NextResponse.json(
        {
          error: "You cannot revoke your only authentication method",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      revoked: true,
    });
  } catch (error) {
    console.error("Credential revocation error:", error);

    return NextResponse.json(
      { error: "Failed to revoke credential" },
      { status: 500 },
    );
  }
}
