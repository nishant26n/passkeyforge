import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/app/lib/prisma";
import { createSession, setSessionCookie } from "@/app/lib/auth/session";
import { origin, rpID } from "@/app/lib/webauthn/config";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const credential = await prisma.credential.findUnique({
      where: {
        credentialID: body.id,
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 401 },
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit(
      "passkey",
      credential.userId,
      ip,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        },
      );
    }

    // The challenge is looked up by its own value, not by user: a
    // usernameless/discoverable-credential request (see
    // /api/webauthn/auth/options) doesn't know the user until this exact
    // lookup identifies which credential — and therefore which user —
    // signed it.
    let challengeValue: string;

    try {
      const clientData = JSON.parse(
        Buffer.from(body.response.clientDataJSON, "base64url").toString(
          "utf8",
        ),
      );
      challengeValue = clientData.challenge;
    } catch {
      return NextResponse.json(
        { error: "Challenge expired, please try again" },
        { status: 400 },
      );
    }

    const challengeRecord = await prisma.challenge.findFirst({
      where: {
        challenge: challengeValue,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    // A challenge generated for a known email is still scoped to that user —
    // it must not be redeemable against a different account's credential.
    if (
      !challengeRecord ||
      (challengeRecord.userId && challengeRecord.userId !== credential.userId)
    ) {
      return NextResponse.json(
        { error: "Challenge expired, please try again" },
        { status: 400 },
      );
    }

    const publicKey = Buffer.from(credential.publicKey, "base64url");

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialID,
        publicKey,
        counter: credential.counter,
        transports: credential.transports
          ? JSON.parse(credential.transports)
          : undefined,
      },
    });

    await prisma.challenge.delete({
      where: {
        id: challengeRecord.id,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Passkey authentication failed" },
        { status: 401 },
      );
    }

    const { newCounter } = verification.authenticationInfo;

    await prisma.credential.update({
      where: {
        id: credential.id,
      },
      data: {
        counter: newCounter,
        lastUsedAt: new Date(),
      },
    });

    const session = await createSession(credential.userId);

    const response = NextResponse.json({
      authenticated: true,
    });

    setSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error("WebAuthn authentication verification error:", error);

    return NextResponse.json(
      { error: "Failed to verify passkey authentication" },
      { status: 500 },
    );
  }
}
