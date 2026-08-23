import { validateAccessToken } from "@/app/lib/oauth/token";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const result = await validateAccessToken(request);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "invalid_token",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      sub: result.data.user.id,
      email: result.data.user.email,
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
