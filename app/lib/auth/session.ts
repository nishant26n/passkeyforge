import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { prisma } from "../prisma";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_NAME = "session";

type SessionCookie = { token: string; expiresAt: Date };

export function setSessionCookie(
  response: NextResponse,
  session: SessionCookie,
) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: session.expiresAt,
    path: "/",
  });
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);

  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function getSession(token: string) {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  // A rotated token has already been replaced. Presenting it again means the
  // cookie leaked, so drop the row rather than honour it until natural expiry.
  if (session.rotatedAt) {
    await prisma.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  return session;
}

export async function deleteSession(token: string) {
  const tokenHash = hashSessionToken(token);

  await prisma.session.deleteMany({
    where: {
      tokenHash,
    },
  });
}

export async function rotateSession(token: string) {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
  });

  if (!session) {
    return null;
  }

  // Already rotated => possible token reuse
  if (session.rotatedAt) {
    // Invalidate the session
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });
    return null;
  }

  // Expired session cannot be rotated: checked here too, not just in the
  // caller, so a direct call can't resurrect a dead session into a fresh 7 days
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });
    return null;
  }

  await prisma.session.update({
    where: {
      id: session.id,
    },
    data: {
      rotatedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });

  // Create a fresh session
  return createSession(session.userId);
}
