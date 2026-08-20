import { prisma } from "@/app/lib/prisma";
import { rpID } from "@/app/lib/webauthn/config";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          error: "Email is required",
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        credentials: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid Credentials" },
        { status: 400 },
      );
    }

    if (user.credentials.length === 0) {
      return NextResponse.json(
        { error: "No passkey is registered for this account" },
        { status: 400 },
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.credentials.map((credential) => ({
        id: credential.credentialID,
        transports: credential.transports
          ? JSON.parse(credential.transports)
          : undefined,
      })),
      userVerification: "preferred",
    });

    await prisma.challenge.create({
      data: {
        challenge: options.challenge,
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error("WebAuthn authentication options error:", error);

    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 },
    );
  }
}
