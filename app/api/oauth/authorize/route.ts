import { getCurrentUser } from "@/app/lib/auth/current-user";
import {
  generateAuthorizationCode,
  hashAuthorizationCode,
} from "@/app/lib/oauth/code";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const responseType = url.searchParams.get("response_type");
    const scope = url.searchParams.get("scope");
    const state = url.searchParams.get("state");
    const codeChallenge = url.searchParams.get("code_challenge");
    const codeChallengeMethod = url.searchParams.get("code_challenge_method");

    // --------------------------------------------------
    // 1. Validate required OAuth parameters
    // --------------------------------------------------

    if (!clientId || !redirectUri || !responseType) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    if (responseType !== "code") {
      return NextResponse.json(
        {
          error: "unsupported_response_type",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 2. Rate limit by client and IP
    // --------------------------------------------------

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("oauth-authorize", clientId, ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "too_many_requests",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    // --------------------------------------------------
    // 3. Find OAuth client
    // --------------------------------------------------

    const client = await prisma.oAuthClient.findUnique({
      where: {
        clientId,
      },
    });

    if (!client) {
      return NextResponse.json(
        {
          error: "invalid_client",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 4. Validate redirect URI
    // --------------------------------------------------

    let registeredRedirectUris: string[];

    try {
      registeredRedirectUris = JSON.parse(client.redirectUris);
    } catch {
      return NextResponse.json(
        {
          error: "invalid_client",
        },
        { status: 400 },
      );
    }

    if (!registeredRedirectUris.includes(redirectUri)) {
      return NextResponse.json(
        {
          error: "invalid_redirect_uri",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 5. Validate PKCE
    // --------------------------------------------------

    if (!codeChallenge || !codeChallengeMethod) {
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "PKCE is required",
        },
        { status: 400 },
      );
    }

    if (codeChallengeMethod !== "S256") {
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Only S256 PKCE is supported",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 6. Make sure user is authenticated
    // --------------------------------------------------

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "login_required",
        },
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // 7. Generate authorization code
    // --------------------------------------------------

    const code = generateAuthorizationCode();
    const codeHash = hashAuthorizationCode(code);

    const expiresAt = new Date(Date.now() + 60 * 1000);

    await prisma.oAuthAuthorizationCode.create({
      data: {
        codeHash,
        clientId: client.id,
        userId: user.id,
        redirectUri,
        scope: scope ?? null,
        codeChallenge,
        codeChallengeMethod,
        expiresAt,
      },
    });

    // --------------------------------------------------
    // 8. Redirect back to client
    // --------------------------------------------------

    const callbackUrl = new URL(redirectUri);

    callbackUrl.searchParams.set("code", code);

    if (state) {
      callbackUrl.searchParams.set("state", state);
    }

    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error("OAuth authorization error:", error);

    return NextResponse.json(
      {
        error: "server_error",
      },
      { status: 500 },
    );
  }
}
