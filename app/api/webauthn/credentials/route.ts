import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate-limit authenticated credential listing.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("credential-list", user.id, ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    const credentials = await prisma.credential.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        credentialID: true,
        aaguid: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        transports: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      credentials,
    });
  } catch (error) {
    console.error("Credential listing error:", error);

    return NextResponse.json(
      { error: "Failed to load credentials" },
      { status: 500 },
    );
  }
}
