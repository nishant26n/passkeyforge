import { describe, expect, it } from "vitest";
import {
  createSession,
  getSession,
  deleteSession,
  rotateSession,
} from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/prisma";

describe("session authentication", () => {
  it("creates and retrieves a session", async () => {
    const user = await prisma.user.create({
      data: {
        email: `session-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });

    const session = await createSession(user.id);

    const result = await getSession(session.token);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe(user.id);

    await deleteSession(session.token);
    await prisma.user.delete({
      where: { id: user.id },
    });
  });

  it("rejects an invalid session token", async () => {
    const result = await getSession("invalid-session-token");

    expect(result).toBeNull();
  });

  it("rejects an expired session", async () => {
    const user = await prisma.user.create({
      data: {
        email: `expired-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });

    const token = crypto.randomUUID();

    const tokenHash = require("node:crypto")
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await getSession(token);

    expect(result).toBeNull();

    await prisma.user.delete({
      where: { id: user.id },
    });
  });
});

it("rotates a session and invalidates the old token", async () => {
  const user = await prisma.user.create({
    data: {
      email: `rotation-${Date.now()}@example.com`,
      passwordHash: "test-hash",
    },
  });

  const oldSession = await createSession(user.id);

  const newSession = await rotateSession(oldSession.token);

  expect(newSession).not.toBeNull();
  expect(newSession?.token).not.toBe(oldSession.token);

  // Old token must no longer authenticate.
  const oldResult = await getSession(oldSession.token);

  expect(oldResult).toBeNull();

  // New token must authenticate.
  const newResult = await getSession(newSession!.token);

  expect(newResult).not.toBeNull();
  expect(newResult?.userId).toBe(user.id);

  await deleteSession(newSession!.token);

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
});

it("rejects reuse of an already rotated session", async () => {
  const user = await prisma.user.create({
    data: {
      email: `reuse-${Date.now()}@example.com`,
      passwordHash: "test-hash",
    },
  });

  const session = await createSession(user.id);

  const rotated = await rotateSession(session.token);

  expect(rotated).not.toBeNull();

  // Attempt to rotate the old token again.
  const reused = await rotateSession(session.token);

  expect(reused).toBeNull();

  await deleteSession(rotated!.token);

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
});
