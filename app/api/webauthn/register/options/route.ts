import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { rpID, rpName } from "@/app/lib/webauthn/config";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Make sure user is logged in
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Credentials the user has already registered
    const existingCredentials = await prisma.credential.findMany({
      where: {
        userId: user.id,
      },
    });

    // Generate webauthn registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.email,
      attestationType: "none",
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialID,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    // Store the challenge server side
    await prisma.challenge.create({
      data: {
        challenge: options.challenge,
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // Return options to browser
    return NextResponse.json(options);
  } catch (error) {
    console.error("WebAuthn registration options error:", error);

    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 },
    );
  }
}
