import { prisma } from "@/app/lib/prisma";
import {
  generateAccessToken,
  hashAccessToken,
  hashAuthorizationCode,
} from "@/app/lib/oauth/code";
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
        { status: 401 },
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
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 5. Find authorization code
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
    // 6. Validate authorization code
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
    // 7. Verify PKCE
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

    if (
      !crypto.timingSafeEqual(
        Buffer.from(calculatedChallenge),
        Buffer.from(authorizationCode.codeChallenge),
      )
    ) {
      return NextResponse.json(
        {
          error: "invalid_grant",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------
    // 8. Consume authorization code
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
    // 9. Generate access token
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
    // 10. Return OAuth token response
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
