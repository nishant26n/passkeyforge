import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { origin, rpID } from "@/app/lib/webauthn/config";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import z from "zod";

const registerVerifySchema = z.object({
  // The attestation itself is the WebAuthn RegistrationResponseJSON —
  // verifyRegistrationResponse() below does the real structural and
  // cryptographic validation; this just makes sure something object-shaped
  // was actually sent.
  credential: z.record(z.string(), z.unknown()),
  name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // Make sure user is logged in
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    const rateLimit = await checkAuthRateLimit("passkey-register", user.id, ip);

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

    // `credential` is the raw attestation from the browser; `name` is the
    // optional label the user typed before starting the ceremony
    const body = await request.json();
    const parsed = registerVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration response" },
        { status: 400 },
      );
    }

    const { name } = parsed.data;
    // Cast structurally off the function's own parameter type rather than
    // importing @simplewebauthn's response type by name — the schema above
    // only confirms this is object-shaped; verifyRegistrationResponse does
    // the actual structural validation.
    const attestation = parsed.data.credential as unknown as Parameters<
      typeof verifyRegistrationResponse
    >[0]["response"];

    const trimmedName = name?.trim() ? name.trim().slice(0, 60) : null;

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
      requireUserVerification: true,
    });

    // Challenges are single use, burn every one this user has either way
    await prisma.challenge.delete({
      where: {
        id: challengeRecord.id,
      },
    });

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
