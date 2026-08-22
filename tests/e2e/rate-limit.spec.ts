import { expect, test } from "./helpers/fixtures";
import { WRONG_PASSWORD, loginViaApi, uniqueEmail } from "./helpers/users";

/**
 * app/lib/rate-limit.ts allows 5 attempts per email per 60s (and 20 per IP).
 * Six attempts is enough to cross the threshold, so these tests stay small.
 *
 * Every test gets a fresh email and — through the `clientIp` fixture — a fresh
 * IP bucket, so no test can push another over the limit.
 */
const EMAIL_LIMIT = 5;

test.describe("rate limiting", () => {
  test("login is rate limited after the configured number of attempts", async ({
    request,
  }) => {
    const email = uniqueEmail("ratelimit-login");
    const statuses: number[] = [];

    for (let attempt = 0; attempt < EMAIL_LIMIT + 1; attempt += 1) {
      const response = await request.post("/api/auth/login", {
        data: { email, password: WRONG_PASSWORD },
      });
      statuses.push(response.status());
    }

    expect(statuses.slice(0, EMAIL_LIMIT)).toEqual(
      Array(EMAIL_LIMIT).fill(401),
    );
    expect(statuses[EMAIL_LIMIT]).toBe(429);
  });

  test("a rate limited login response asks the caller to back off", async ({
    request,
  }) => {
    const email = uniqueEmail("ratelimit-headers");

    for (let attempt = 0; attempt < EMAIL_LIMIT; attempt += 1) {
      await request.post("/api/auth/login", {
        data: { email, password: WRONG_PASSWORD },
      });
    }

    const blocked = await request.post("/api/auth/login", {
      data: { email, password: WRONG_PASSWORD },
    });

    expect(blocked.status()).toBe(429);
    expect(blocked.headers()["retry-after"]).toBe("60");
    expect(await blocked.json()).toEqual({
      error: "Too many attempts. Please try again later.",
    });
  });

  test("the correct password is refused once the limit is reached", async ({
    request,
    createUser,
  }) => {
    const user = await createUser({ prefix: "ratelimit-valid" });

    for (let attempt = 0; attempt < EMAIL_LIMIT; attempt += 1) {
      await request.post("/api/auth/login", {
        data: { email: user.email, password: WRONG_PASSWORD },
      });
    }

    const response = await request.post("/api/auth/login", {
      data: { email: user.email, password: user.password },
    });

    expect(response.status()).toBe(429);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("the login form surfaces the rate limit to the user", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("ratelimit-ui");

    for (let attempt = 0; attempt < EMAIL_LIMIT; attempt += 1) {
      await request.post("/api/auth/login", {
        data: { email, password: WRONG_PASSWORD },
      });
    }

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page
      .getByRole("textbox", { name: "Password", exact: true })
      .fill(WRONG_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Too many attempts. Please try again later." }),
    ).toBeVisible();
  });

  test("recovery-code attempts are rate limited", async ({
    request,
    createUser,
  }) => {
    const user = await createUser({ prefix: "ratelimit-recovery" });
    const statuses: number[] = [];

    for (let attempt = 0; attempt < EMAIL_LIMIT + 1; attempt += 1) {
      const response = await request.post("/api/auth/recovery/code", {
        data: { email: user.email, code: "0000-0000-0000" },
      });
      statuses.push(response.status());
    }

    expect(statuses.slice(0, EMAIL_LIMIT)).toEqual(
      Array(EMAIL_LIMIT).fill(401),
    );
    expect(statuses[EMAIL_LIMIT]).toBe(429);
  });

  test("authenticator-code attempts share the recovery rate limit", async ({
    request,
    createUser,
  }) => {
    const user = await createUser({ prefix: "ratelimit-totp" });
    const statuses: number[] = [];

    for (let attempt = 0; attempt < EMAIL_LIMIT + 1; attempt += 1) {
      const response = await request.post("/api/auth/recovery/totp", {
        data: { email: user.email, code: "000000" },
      });
      statuses.push(response.status());
    }

    expect(statuses.slice(0, EMAIL_LIMIT)).toEqual(
      Array(EMAIL_LIMIT).fill(401),
    );
    expect(statuses[EMAIL_LIMIT]).toBe(429);
  });

  test("the recovery limit is shared between the code and authenticator routes", async ({
    request,
    createUser,
  }) => {
    const user = await createUser({ prefix: "ratelimit-shared" });

    // Both routes bucket on the same `recovery:email:<email>` key.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request.post("/api/auth/recovery/code", {
        data: { email: user.email, code: "0000-0000-0000" },
      });
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request.post("/api/auth/recovery/totp", {
        data: { email: user.email, code: "000000" },
      });
    }

    const blocked = await request.post("/api/auth/recovery/totp", {
      data: { email: user.email, code: "000000" },
    });

    expect(blocked.status()).toBe(429);
  });

  test("rate limits are scoped per email address", async ({
    request,
    createUser,
  }) => {
    const limited = await createUser({ prefix: "ratelimit-scoped-a" });
    const untouched = await createUser({ prefix: "ratelimit-scoped-b" });

    for (let attempt = 0; attempt < EMAIL_LIMIT + 1; attempt += 1) {
      await request.post("/api/auth/login", {
        data: { email: limited.email, password: WRONG_PASSWORD },
      });
    }

    const response = await request.post("/api/auth/login", {
      data: { email: untouched.email, password: untouched.password },
    });

    expect(response.status()).toBe(200);
  });

  test("passkey authentication is rate limited", async ({ request }) => {
    const email = uniqueEmail("ratelimit-passkey");
    const statuses: number[] = [];

    for (let attempt = 0; attempt < EMAIL_LIMIT + 1; attempt += 1) {
      const response = await request.post("/api/webauthn/auth/options", {
        data: { email },
      });
      statuses.push(response.status());
    }

    // Unknown email each time (400) until the shared email bucket trips 429.
    expect(statuses.slice(0, EMAIL_LIMIT)).toEqual(
      Array(EMAIL_LIMIT).fill(400),
    );
    expect(statuses[EMAIL_LIMIT]).toBe(429);
  });

  test("authenticated TOTP verification is rate limited", async ({
    request,
    createUser,
  }) => {
    const user = await createUser({ prefix: "ratelimit-totp-verify" });
    await loginViaApi(request, user);
    await request.post("/api/auth/totp/setup");

    const statuses: number[] = [];

    for (let attempt = 0; attempt < EMAIL_LIMIT + 1; attempt += 1) {
      const response = await request.post("/api/auth/totp/verify", {
        data: { code: "000000" },
      });
      statuses.push(response.status());
    }

    expect(statuses.slice(0, EMAIL_LIMIT)).toEqual(
      Array(EMAIL_LIMIT).fill(400),
    );
    expect(statuses[EMAIL_LIMIT]).toBe(429);
  });
});
