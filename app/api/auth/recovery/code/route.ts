import { hashRecoveryCode } from "@/app/lib/auth/recovery-code";
import { createSession, setSessionCookie } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    const code = String(body.code ?? "").trim();

    if (!email || !code) {
      return NextResponse.json(
        {
          error: "Email and code are required",
        },
        { status: 400 },
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");

    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("recovery", email, ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid recovery credentials" },
        { status: 401 },
      );
    }

    const codeHash = hashRecoveryCode(code);

    const recoveryCode = await prisma.recoveryCode.findFirst({
      where: {
        userId: user.id,
        codeHash,
        usedAt: null,
      },
    });

    if (!recoveryCode) {
      return NextResponse.json(
        { error: "Invalid or already used recovery code" },
        { status: 401 },
      );
    }

    // Consume the cde before creating the session
    const consumed = await prisma.recoveryCode.updateMany({
      where: {
        id: recoveryCode.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      return NextResponse.json(
        { error: "Invalid or already used recovery code" },
        { status: 401 },
      );
    }

    // Create a new session for the user
    const session = await createSession(user.id);
    const response = NextResponse.json({
      authenticated: true,
    });

    // createSession only writes the DB row — without this the browser holds no
    // session cookie and the redirect to / bounces straight back to /login
    setSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error("Recovery code authentication error:", error);

    return NextResponse.json(
      { error: "Failed to authenticate with recovery code" },
      { status: 500 },
    );
  }
}
