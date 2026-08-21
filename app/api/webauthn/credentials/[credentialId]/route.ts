// api/webauthn/credentials/[credentialId]

import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{
    credentialId: string;
  }>;
};

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { credentialId } = await params;

    // Make sure this cred id belongs to the currently logged in user
    const credential = await prisma.credential.findFirst({
      where: {
        id: credentialId,
        userId: user.id,
      },
    });

    if (!credential) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 },
      );
    }

    await prisma.credential.delete({
      where: {
        id: credential.id,
      },
    });

    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("Credential revocation error:", error);

    return NextResponse.json(
      { error: "Failed to revoke credential" },
      { status: 500 },
    );
  }
}
