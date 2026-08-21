import { createSession, setSessionCookie } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/prisma";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

// Must stay byte-identical to the generate route: same input casing, same
// digest encoding, or no stored hash will ever match
function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

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
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!recoveryCode) {
      return NextResponse.json(
        { error: "Invalid or already used recovery code" },
        { status: 401 },
      );
    }

    // Consume the cde before creating the session
    await prisma.recoveryCode.update({
      where: {
        id: recoveryCode.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

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
