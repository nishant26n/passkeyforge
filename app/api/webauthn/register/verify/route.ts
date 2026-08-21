import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { origin, rpID } from "@/app/lib/webauthn/config";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Make sure user is logged in
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `credential` is the raw attestation from the browser; `name` is the
    // optional label the user typed before starting the ceremony
    const { credential: attestation, name } = await request.json();

    const trimmedName =
      typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : null;

    // Look up the challenge we issued in /register/options
    const challengeRecord = await prisma.challenge.findFirst({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challengeRecord) {
      return NextResponse.json(
        { error: "Challenge expired, please try again" },
        { status: 400 },
      );
    }

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    // Challenges are single use, burn every one this user has either way
    await prisma.challenge.deleteMany({ where: { userId: user.id } });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 400 },
      );
    }

    const { credential, aaguid } = verification.registrationInfo;

    await prisma.credential.create({
      data: {
        credentialID: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports
          ? JSON.stringify(credential.transports)
          : null,
        aaguid,
        name: trimmedName,
        userId: user.id,
      },
    });

    return NextResponse.json({ verified: true }, { status: 201 });
  } catch (error) {
    console.error("WebAuthn registration verification error:", error);

    return NextResponse.json(
      { error: "Failed to verify passkey registration" },
      { status: 500 },
    );
  }
}
