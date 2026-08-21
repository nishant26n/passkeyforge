// /api/webauthn/credentials

import { getCurrentUser } from "@/app/lib/auth/current-user";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await prisma.credential.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      credentialID: true,
      aaguid: true,
      name: true,
      createdAt: true,
      lastUsedAt: true,
      transports: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    credentials,
  });
}
