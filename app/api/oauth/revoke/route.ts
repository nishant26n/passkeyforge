import { prisma } from "@/app/lib/prisma";
import { hashAccessToken } from "@/app/lib/oauth/code";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let body: Record<string, string>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();

      body = Object.fromEntries(
        Array.from(formData.entries()).map(([key, value]) => [
          key,
          String(value),
        ]),
      );
    } else {
      body = await request.json();
    }

    const token = body.token;

    if (!token) {
      return NextResponse.json(
        {
          error: "invalid_request",
        },
        { status: 400 },
      );
    }

    const tokenHash = hashAccessToken(token);

    const accessToken = await prisma.oAuthAccessToken.findUnique({
      where: {
        tokenHash,
      },
    });

    /*
     * RFC-style revocation behavior:
     * Don't reveal whether the token actually existed.
     *
     * A client can safely call this endpoint multiple times.
     */
    if (!accessToken) {
      return new NextResponse(null, {
        status: 200,
      });
    }

    if (!accessToken.revokedAt) {
      await prisma.oAuthAccessToken.update({
        where: {
          id: accessToken.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return new NextResponse(null, {
      status: 200,
    });
  } catch (error) {
    console.error("OAuth token revocation error:", error);

    return NextResponse.json(
      {
        error: "server_error",
      },
      { status: 500 },
    );
  }
}
