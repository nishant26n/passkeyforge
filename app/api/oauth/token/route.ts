import { prisma } from "@/app/lib/prisma";
import {
  generateAccessToken,
  hashAccessToken,
  hashAuthorizationCode,
} from "@/app/lib/oauth/code";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

const ACCESS_TOKEN_DURATION_MS = 60 * 60 * 1000;

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

    const grantType = body.grant_type;
    const code = body.code;
    const redirectUri = body.redirect_uri;
    const clientId = body.client_id;
    const codeVerifier = body.code_verifier;

    // --------------------------------------------------
    // 1. Validate grant type
    // --------------------------------------------------

    if (grantType !== "authorization_code") {
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 2. Validate required parameters
    // --------------------------------------------------

    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return NextResponse.json(
        {
          error: "invalid_request",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 3. Rate limit by client and IP
    // --------------------------------------------------

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("oauth-token", clientId, ip);

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
    // 4. Find OAuth client
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
        { status: 401 },
      );
    }

    // --------------------------------------------------
    // 5. Validate redirect URI
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
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 6. Find authorization code
    // --------------------------------------------------

    const codeHash = hashAuthorizationCode(code);

    const authorizationCode = await prisma.oAuthAuthorizationCode.findUnique({
      where: {
        codeHash,
      },
    });

    if (!authorizationCode) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 7. Validate authorization code
    // --------------------------------------------------

    if (authorizationCode.clientId !== client.id) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    if (authorizationCode.redirectUri !== redirectUri) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    if (authorizationCode.usedAt) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    if (authorizationCode.expiresAt <= new Date()) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 8. Verify PKCE
    // --------------------------------------------------

    if (
      authorizationCode.codeChallengeMethod !== "S256" ||
      !authorizationCode.codeChallenge
    ) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    const calculatedChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const calculatedChallengeBuffer = Buffer.from(calculatedChallenge);
    const storedChallengeBuffer = Buffer.from(authorizationCode.codeChallenge);

    // timingSafeEqual throws on mismatched buffer lengths, so an
    // attacker-controlled length would surface as a 500 instead of the
    // invalid_grant this route otherwise returns for a mismatch.
    if (
      calculatedChallengeBuffer.length !== storedChallengeBuffer.length ||
      !crypto.timingSafeEqual(calculatedChallengeBuffer, storedChallengeBuffer)
    ) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 9. Consume authorization code
    // --------------------------------------------------

    const consumed = await prisma.oAuthAuthorizationCode.updateMany({
      where: {
        id: authorizationCode.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 10. Generate access token
    // --------------------------------------------------

    const accessToken = generateAccessToken();
    const accessTokenHash = hashAccessToken(accessToken);

    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_DURATION_MS);

    await prisma.oAuthAccessToken.create({
      data: {
        tokenHash: accessTokenHash,
        clientId: client.id,
        userId: authorizationCode.userId,
        scope: authorizationCode.scope,
        expiresAt,
      },
    });

    // --------------------------------------------------
    // 11. Return OAuth token response
    // --------------------------------------------------

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_DURATION_MS / 1000),
      scope: authorizationCode.scope ?? undefined,
    });
  } catch (error) {
    console.error("OAuth token error:", error);

    return NextResponse.json(
      {
        error: "server_error",
      },
      { status: 500 },
    );
  }
}
