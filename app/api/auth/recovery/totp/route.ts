import { createSession, setSessionCookie } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";
import { verify } from "otplib";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    const code = String(body.code ?? "").trim();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
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
      where: { email },
    });

    if (!user || !user.totpEnabled || !user.totpSecret) {
      return NextResponse.json(
        { error: "Invalid recovery credentials" },
        { status: 401 },
      );
    }

    // A malformed code can never verify; reject it the same way a wrong one
    // would rather than pass free-form input into otplib.
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid recovery code" },
        { status: 401 },
      );
    }

    const result = await verify({
      secret: user.totpSecret,
      token: code,
    });

    if (!result.valid) {
      return NextResponse.json(
        { error: "Invalid recovery code" },
        { status: 401 },
      );
    }

    const session = await createSession(user.id);

    const response = NextResponse.json({
      authenticated: true,
    });

    // createSession only writes the DB row — without this the browser holds no
    // session cookie and the redirect to / bounces straight back to /login
    setSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error("TOTP recovery error:", error);

    return NextResponse.json(
      { error: "Failed to authenticate with TOTP" },
      { status: 500 },
    );
  }
}
