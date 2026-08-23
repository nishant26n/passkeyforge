import { hasScope } from "@/app/lib/oauth/scope";
import { validateAccessToken } from "@/app/lib/oauth/token";
import { NextResponse } from "next/server";

/**
 * Resource-server endpoint distinct from /api/oauth/userinfo: it enforces
 * OAuth scope rather than returning the same claims to every valid token.
 * "openid" gates access to the endpoint at all; "email" additionally gates
 * the email claim in the response.
 */
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

    const { user, token } = result.data;

    if (!hasScope(token.scope, "openid")) {
      return NextResponse.json(
        {
          error: "insufficient_scope",
          error_description: "This endpoint requires the openid scope",
        },
        { status: 403 },
      );
    }

    const body: { sub: string; scope: string; email?: string } = {
      sub: user.id,
      scope: token.scope ?? "",
    };

    if (hasScope(token.scope, "email")) {
      body.email = user.email;
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("OAuth me error:", error);

    return NextResponse.json(
      {
        error: "server_error",
      },
      { status: 500 },
    );
  }
}
