import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const secret = generateSecret();

    const uri = generateURI({
      issuer: "PasskeyForge",
      label: user.email,
      secret,
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        totpSecret: secret,
        totpEnabled: false,
      },
    });

    return NextResponse.json({ uri });
  } catch (error) {
    console.log("Error generating TOTP URI", error);

    return NextResponse.json(
      {
        error: "Failed to generate TOTP URI",
      },
      { status: 500 },
    );
  }
}
