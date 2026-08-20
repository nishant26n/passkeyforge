import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { prisma } from "@/app/lib/prisma";
import { createSession, setSessionCookie } from "@/app/lib/auth/session";
import { origin, rpID } from "@/app/lib/webauthn/config";

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

    const challengeRecord = await prisma.challenge.findFirst({
      where: {
        userId: credential.userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!challengeRecord) {
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

    await prisma.challenge.deleteMany({
      where: {
        userId: credential.userId,
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
