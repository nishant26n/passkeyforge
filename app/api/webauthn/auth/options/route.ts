import { prisma } from "@/app/lib/prisma";
import { checkAuthRateLimit } from "@/app/lib/rate-limit";
import { rpID } from "@/app/lib/webauthn/config";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import z from "zod";

// email/usernameless are both optional — which combination was sent decides
// which of the two branches below runs, so shape is validated here but the
// choice of branch stays in plain control flow rather than the schema.
const authOptionsSchema = z.object({
  email: z
    .string()
    .trim()
    .transform((email) => email.toLowerCase())
    .optional(),
  usernameless: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = authOptionsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const email = parsed.data.email ?? "";
    const usernameless = parsed.data.usernameless === true;

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

    if (!email) {
      if (!usernameless) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 },
        );
      }

      // Usernameless / discoverable-credential flow: no email to look a user
      // up by, so no allowCredentials list either — the authenticator offers
      // its own resident credentials and the assertion's credential ID is
      // what identifies the account, in /api/webauthn/auth/verify.
      const rateLimit = await checkAuthRateLimit("passkey", ip, ip);

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

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
      });

      await prisma.challenge.create({
        data: {
          challenge: options.challenge,
          userId: null,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return NextResponse.json(options);
    }

    const rateLimit = await checkAuthRateLimit("passkey", email, ip);

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

      userVerification: "required",
    });

    // Store challenge server-side.
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
