import { prisma } from "@/app/lib/prisma";
import { hashAccessToken } from "@/app/lib/oauth/code";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "invalid_token",
        },
        { status: 401 },
      );
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "invalid_token",
        },
        { status: 401 },
      );
    }

    const tokenHash = hashAccessToken(accessToken);

    const token = await prisma.oAuthAccessToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
        client: true,
      },
    });

    if (!token) {
      return NextResponse.json(
        {
          error: "invalid_token",
        },
        { status: 401 },
      );
    }

    if (token.revokedAt) {
      return NextResponse.json(
        {
          error: "invalid_token",
        },
        { status: 401 },
      );
    }

    if (token.expiresAt <= new Date()) {
      return NextResponse.json(
        {
          error: "invalid_token",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      sub: token.user.id,
      email: token.user.email,
    });
  } catch (error) {
    console.error("OAuth userinfo error:", error);

    return NextResponse.json(
      {
        error: "server_error",
      },
      { status: 500 },
    );
  }
}
