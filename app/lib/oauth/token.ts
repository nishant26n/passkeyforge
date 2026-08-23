import { prisma } from "@/app/lib/prisma";
import { hashAccessToken } from "@/app/lib/oauth/code";

export type ValidatedOAuthToken = {
  token: {
    id: string;
    scope: string | null;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
  };
  client: {
    id: string;
    clientId: string;
    name: string;
  };
};

export type ValidateAccessTokenResult =
  | { ok: true; data: ValidatedOAuthToken }
  | { ok: false };

/**
 * Extracts, hashes, and validates a bearer access token off a request.
 * Missing, unknown, expired, and revoked tokens all fail the same way — the
 * caller decides how to report that; this only decides whether the token is
 * currently good for use.
 */
export async function validateAccessToken(
  request: Request,
): Promise<ValidateAccessTokenResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return { ok: false };
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    return { ok: false };
  }

  const tokenHash = hashAccessToken(accessToken);

  const token = await prisma.oAuthAccessToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
      client: true,
    },
  });

  if (!token || token.revokedAt || token.expiresAt <= new Date()) {
    return { ok: false };
  }

  return {
    ok: true,
    data: {
      token: {
        id: token.id,
        scope: token.scope,
        expiresAt: token.expiresAt,
      },
      user: {
        id: token.user.id,
        email: token.user.email,
      },
      client: {
        id: token.client.id,
        clientId: token.client.clientId,
        name: token.client.name,
      },
    },
  };
}
