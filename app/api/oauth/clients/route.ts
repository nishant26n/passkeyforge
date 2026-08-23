import { getCurrentUser } from "@/app/lib/auth/current-user";
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
} from "@/app/lib/oauth/client";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import z from "zod";

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  redirectUris: z.array(z.string().url()).min(1).max(10),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const result = createClientSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid client registration data" },
        { status: 400 },
      );
    }

    const { name, redirectUris } = result.data;

    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const clientSecretHash = hashClientSecret(clientSecret);

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash,
        name,
        redirectUris: JSON.stringify(redirectUris),
      },
    });

    return NextResponse.json(
      {
        create: {
          id: client.id,
          clientId: client.clientId,
          name: client.name,
          redirectUris,
          createdAt: client.createdAt,
        },
        // IMPORTANT:
        // This is returned only during creation.
        clientSecret,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("OAuth client registration error:", error);

    return NextResponse.json(
      { error: "Failed to register OAuth client" },
      { status: 500 },
    );
  }
}
