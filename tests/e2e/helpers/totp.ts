const STEP_SECONDS = 30;

/**
 * otplib is ESM-only and one of its dependencies cannot be `require`d from the
 * CommonJS output Playwright compiles specs into, so it is loaded lazily.
 */
async function otplib() {
  return import("otplib");
}

/**
 * Produces a currently valid TOTP for a secret, using the same library the
 * server verifies with — the test acts as the authenticator app.
 *
 * If the current 30 second step is nearly over the helper waits for the next
 * one, so a code can never expire between being generated here and being
 * submitted by the test.
 *
 * Callers must never log the return value.
 */
export async function currentTotpCode(secret: string): Promise<string> {
  const secondsIntoStep = Math.floor(Date.now() / 1000) % STEP_SECONDS;
  const secondsLeft = STEP_SECONDS - secondsIntoStep;

  if (secondsLeft < 5) {
    await new Promise((resolve) =>
      setTimeout(resolve, secondsLeft * 1000 + 500),
    );
  }

  const { generate } = await otplib();
  return generate({ secret });
}

/**
 * A syntactically valid six digit code that is not the current one, for
 * negative tests. Derived from the real code so it can never collide with it.
 */
export async function wrongTotpCode(secret: string): Promise<string> {
  const valid = await currentTotpCode(secret);
  const firstDigit = (Number(valid[0]) + 5) % 10;
  return `${firstDigit}${valid.slice(1)}`;
}
