import {
  countChallengesForUser,
  countSessionsForUser,
  getCredentialsForUser,
} from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import {
  loginViaUi,
  logoutViaUi,
  readSessionCookie,
  uniqueEmail,
} from "./helpers/users";
import {
  addVirtualAuthenticator,
  captureJsonPost,
  fetchFromPage,
  registerPasskeyViaUi,
  tamperClientDataOrigin,
} from "./helpers/webauthn";

/**
 * Real browser passkey sign-in, driven by Chrome's CDP virtual authenticator.
 * The assertions it produces are verified by the app's normal
 * `verifyAuthenticationResponse` call — signature, challenge, origin and RP ID
 * checks all run for real.
 */
test.describe("passkey login", () => {
  test("passkey sign-in page loads with its email field", async ({ page }) => {
    await page.goto("/login/passkey");

    await expect(page).toHaveTitle("Sign in with a passkey · Passkey Forge");
    await expect(
      page.getByRole("heading", { name: "Sign in with a passkey" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Login with Passkey" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in with email" }),
    ).toHaveAttribute("href", "/login");
  });

  test("passkey sign-in rejects an unknown email", async ({ page }) => {
    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(uniqueEmail("no-such-user"));
    await page.getByRole("button", { name: "Login with Passkey" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid Credentials" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("passkey sign-in rejects a user with no registered passkey", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No passkey is registered for this account" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("passkey sign-in validates the email field before calling the API", async ({
    page,
  }) => {
    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Login with Passkey" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("user can sign in with a registered passkey", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "Test key");
    await logoutViaUi(page);

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();

    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(page.getByText(user.email)).toBeVisible();

    const cookie = await readSessionCookie(page);
    expect(cookie).not.toBeNull();
    expect(cookie!.httpOnly).toBe(true);
    expect(await countSessionsForUser(user.id)).toBe(1);
  });

  test("successful passkey sign-in records the credential as used", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page);
    await logoutViaUi(page);

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();

    // The challenge is burned and the credential now shows a last-used date.
    expect(await countChallengesForUser(user.id)).toBe(0);
    await expect(page.getByText(/Last used /)).toBeVisible();
  });

  test("authentication options are generated and a challenge is stored", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page);
    const stored = await getCredentialsForUser(user.id);
    await logoutViaUi(page);

    const result = await fetchFromPage(page, "/api/webauthn/auth/options", {
      method: "POST",
      body: { email: user.email },
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ rpId: "localhost" });
    expect(typeof result.body!.challenge).toBe("string");
    expect(
      (result.body!.allowCredentials as Array<{ id: string }>).map((c) => c.id),
    ).toEqual([stored[0].credentialID]);
    expect(await countChallengesForUser(user.id)).toBe(1);
  });

  test("auth options require an email", async ({ request }) => {
    const response = await request.post("/api/webauthn/auth/options", {
      data: {},
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Email is required" });
  });

  test("auth verify rejects an unknown credential", async ({ request }) => {
    const response = await request.post("/api/webauthn/auth/verify", {
      data: { id: "not-a-real-credential-id" },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Credential not found" });
  });

  test("a replayed passkey assertion is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page);
    await logoutViaUi(page);

    const captured = captureJsonPost<Record<string, unknown>>(
      page,
      "/api/webauthn/auth/verify",
    );

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    expect(captured.value).not.toBeNull();

    await logoutViaUi(page);

    const replay = await fetchFromPage(page, "/api/webauthn/auth/verify", {
      method: "POST",
      body: captured.value!,
    });

    expect(replay.status).toBe(400);
    expect(replay.body).toEqual({
      error: "Challenge expired, please try again",
    });
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("a replayed assertion is rejected even against a fresh challenge", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page);
    await logoutViaUi(page);

    const captured = captureJsonPost<Record<string, unknown>>(
      page,
      "/api/webauthn/auth/verify",
    );

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    await logoutViaUi(page);

    // Issue a brand new challenge, then replay the old assertion against it.
    await fetchFromPage(page, "/api/webauthn/auth/options", {
      method: "POST",
      body: { email: user.email },
    });

    const replay = await fetchFromPage(page, "/api/webauthn/auth/verify", {
      method: "POST",
      body: captured.value!,
    });

    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("an assertion from another origin is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page);
    await logoutViaUi(page);

    await tamperClientDataOrigin(
      page,
      "**/api/webauthn/auth/verify",
      "https://evil.example.com",
      (body) => body,
    );

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeHidden();
    expect(await readSessionCookie(page)).toBeNull();
  });
});
