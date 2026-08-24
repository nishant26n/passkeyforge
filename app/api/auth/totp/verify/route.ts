import { NextResponse } from "next/server";
import { verify } from "otplib";
import z from "zod";

import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";

const totpVerifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    // 1. Make sure the user is logged in
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Read the code from the request
    const body = await request.json();
    const parsed = totpVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid 6-digit code" },
        { status: 400 },
      );
    }

    const { code } = parsed.data;

    // 3. Make sure TOTP setup was started
    if (!user.totpSecret) {
      return NextResponse.json(
        { error: "TOTP setup has not been started" },
        { status: 400 },
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("totp-verify", user.id, ip);

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

    // 4. Verify the code against the stored secret
    const result = await verify({
      secret: user.totpSecret,
      token: code,
    });

    if (!result.valid) {
      return NextResponse.json(
        { error: "Invalid authentication code" },
        { status: 400 },
      );
    }

    // 5. Code is valid → enable TOTP
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        totpEnabled: true,
      },
    });

    return NextResponse.json({
      verified: true,
      totpEnabled: true,
    });
  } catch (error) {
    console.error("TOTP verification error:", error);

    return NextResponse.json(
      { error: "Failed to verify TOTP" },
      { status: 500 },
    );
  }
}
