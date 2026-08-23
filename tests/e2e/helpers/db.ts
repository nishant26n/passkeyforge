import { createHash } from "node:crypto";
import { Pool } from "pg";

/**
 * Direct database access for E2E assertions and cleanup.
 *
 * `pg` is used instead of the generated Prisma client so the Playwright worker
 * does not have to load the app's TypeScript client at runtime. Table names are
 * the Prisma model names (the schema declares no `@@map`).
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Load it before running Playwright (see playwright.config.ts).",
  );
}

/**
 * Every user this suite creates lives on this domain. All destructive SQL below
 * is constrained to it so a shared development database can never lose rows
 * that the suite did not create itself.
 */
export const TEST_EMAIL_DOMAIN = "e2e.passkeyforge.test";

const pool = new Pool({ connectionString, max: 3 });

export async function closePool() {
  await pool.end();
}

async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export type DbUser = {
  id: string;
  email: string;
  totpEnabled: boolean;
  totpSecret: string | null;
};

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const rows = await query<DbUser>(
    'SELECT id, email, "totpEnabled", "totpSecret" FROM "User" WHERE email = $1',
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export type DbCredential = {
  id: string;
  credentialID: string;
  name: string | null;
  counter: number;
  userId: string;
};

export async function getCredentialsForUser(
  userId: string,
): Promise<DbCredential[]> {
  return query<DbCredential>(
    'SELECT id, "credentialID", name, counter, "userId" FROM "Credential" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
    [userId],
  );
}

export async function getRecoveryCodeStats(userId: string) {
  const rows = await query<{ total: string; used: string }>(
    'SELECT COUNT(*) AS total, COUNT("usedAt") AS used FROM "RecoveryCode" WHERE "userId" = $1',
    [userId],
  );
  return {
    total: Number(rows[0]?.total ?? 0),
    used: Number(rows[0]?.used ?? 0),
  };
}

/** Mirrors `hashSessionToken` in app/lib/auth/session.ts. */
function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSessionByToken(token: string) {
  const rows = await query<{
    id: string;
    userId: string;
    rotatedAt: Date | null;
    expiresAt: Date;
  }>(
    'SELECT id, "userId", "rotatedAt", "expiresAt" FROM "Session" WHERE "tokenHash" = $1',
    [hashSessionToken(token)],
  );
  return rows[0] ?? null;
}

export async function countSessionsForUser(userId: string) {
  const rows = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM "Session" WHERE "userId" = $1',
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Backdates every session for a user. Used to observe how the app handles an
 * expired session without waiting out the seven day lifetime.
 */
export async function expireSessionsForUser(userId: string) {
  await query('UPDATE "Session" SET "expiresAt" = NOW() - INTERVAL \'1 day\' WHERE "userId" = $1', [
    userId,
  ]);
}

/** Backdates every stored WebAuthn challenge for a user. */
export async function expireChallengesForUser(userId: string) {
  await query(
    'UPDATE "Challenge" SET "expiresAt" = NOW() - INTERVAL \'1 minute\' WHERE "userId" = $1',
    [userId],
  );
}

export async function countChallengesForUser(userId: string) {
  const rows = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM "Challenge" WHERE "userId" = $1',
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Deletes the given test users. Credential/Session/Challenge/RecoveryCode rows
 * go with them through the `onDelete: Cascade` relations in the Prisma schema.
 *
 * The domain check is a hard guard: anything outside the E2E domain is ignored.
 */
export async function deleteUsersByEmails(emails: string[]) {
  const safe = emails
    .map((email) => email.toLowerCase())
    .filter((email) => email.endsWith(`@${TEST_EMAIL_DOMAIN}`));

  if (safe.length === 0) return;

  await query('DELETE FROM "User" WHERE email = ANY($1::text[])', [safe]);
}
