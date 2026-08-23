import {
  countChallengesForUser,
  expireChallengesForUser,
  getCredentialsForUser,
} from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { loginViaUi } from "./helpers/users";
import {
  addVirtualAuthenticator,
  captureJsonPost,
  fetchFromPage,
  tamperClientDataOrigin,
} from "./helpers/webauthn";

type RegisterVerifyBody = {
  credential: Record<string, unknown>;
  name?: string;
};

/**
 * Real browser WebAuthn end-to-end tests.
 *
 * These drive Chrome's CDP virtual authenticator, which produces genuine
 * attestations signed by a real key pair. The server runs its normal
 * `verifyRegistrationResponse` checks — challenge, origin, RP ID and signature
 * are all verified for real. Nothing is stubbed.
 */
test.describe("passkey registration", () => {
  test("passkey management is not reachable without a session", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("button", { name: "Add a passkey" })).toBeHidden();
  });

  test("register options endpoint rejects an unauthenticated caller", async ({
    request,
  }) => {
    const response = await request.post("/api/webauthn/register/options");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("authenticated user sees the passkey manager with no passkeys yet", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    await expect(
      page.getByRole("heading", { name: "Passkeys" }),
    ).toBeVisible();
    await expect(page.getByText("0 registered")).toBeVisible();
    await expect(
      page.getByText("No passkeys yet. Add one to sign in without your password."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a passkey" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
  });

  test("user can register a passkey and it is stored", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);

    await page.getByLabel("Name").fill("Work laptop");
    await page.getByRole("button", { name: "Add a passkey" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Passkey added" }),
    ).toBeVisible();
    await expect(page.getByText("1 registered")).toBeVisible();
    await expect(page.getByText("Work laptop")).toBeVisible();

    const stored = await getCredentialsForUser(user.id);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Work laptop");
    expect(stored[0].credentialID).toBeTruthy();

    // Challenges are single-use; the verify route burns them all.
    expect(await countChallengesForUser(user.id)).toBe(0);
  });

  test("registration options request stores a challenge for the user", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(page, "/api/webauthn/register/options", {
      method: "POST",
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ rp: { id: "localhost" } });
    expect(typeof result.body!.challenge).toBe("string");
    expect(await countChallengesForUser(user.id)).toBe(1);
  });

  test("registration options exclude a passkey the user already has", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);

    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("1 registered")).toBeVisible();

    const result = await fetchFromPage(page, "/api/webauthn/register/options", {
      method: "POST",
    });
    const excluded = result.body!.excludeCredentials as Array<{ id: string }>;
    const stored = await getCredentialsForUser(user.id);

    expect(excluded.map((entry) => entry.id)).toEqual([stored[0].credentialID]);
  });

  test("registering the same authenticator twice is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);

    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("1 registered")).toBeVisible();

    // excludeCredentials makes the authenticator itself refuse the second
    // ceremony, which is the real duplicate-prevention path.
    await page.getByRole("button", { name: "Add a passkey" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "This device already has a passkey for your account" }),
    ).toBeVisible();
    expect(await getCredentialsForUser(user.id)).toHaveLength(1);
  });

  test("replaying an attestation against a fresh challenge is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);

    const captured = captureJsonPost<RegisterVerifyBody>(
      page,
      "/api/webauthn/register/verify",
    );

    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("1 registered")).toBeVisible();
    expect(captured.value).not.toBeNull();

    // A new ceremony issues a new challenge; the old attestation still signs
    // over the old one, so verification must fail.
    await fetchFromPage(page, "/api/webauthn/register/options", {
      method: "POST",
    });

    const replay = await fetchFromPage(page, "/api/webauthn/register/verify", {
      method: "POST",
      body: { credential: captured.value!.credential, name: "replayed" },
    });

    expect(replay.status).toBeGreaterThanOrEqual(400);
    expect(await getCredentialsForUser(user.id)).toHaveLength(1);
  });

  test("an expired challenge is rejected", async ({ page, createUser }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);

    const captured = captureJsonPost<RegisterVerifyBody>(
      page,
      "/api/webauthn/register/verify",
    );
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("1 registered")).toBeVisible();

    // Issue a challenge, then age it past its five minute window.
    await fetchFromPage(page, "/api/webauthn/register/options", {
      method: "POST",
    });
    await expireChallengesForUser(user.id);

    const result = await fetchFromPage(page, "/api/webauthn/register/verify", {
      method: "POST",
      body: { credential: captured.value!.credential },
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: "Challenge expired, please try again",
    });
    expect(await getCredentialsForUser(user.id)).toHaveLength(1);
  });

  test("verifying with no challenge at all is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(page, "/api/webauthn/register/verify", {
      method: "POST",
      body: { credential: {} },
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: "Challenge expired, please try again",
    });
    expect(await getCredentialsForUser(user.id)).toHaveLength(0);
  });

  test("an attestation from another origin is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);

    await tamperClientDataOrigin(
      page,
      "**/api/webauthn/register/verify",
      "https://evil.example.com",
      (body) => body.credential as Record<string, unknown>,
    );

    await page.getByRole("button", { name: "Add a passkey" }).click();

    // The route's catch-all turns the origin mismatch into an error response;
    // what matters is that no credential is created.
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByText("1 registered")).toBeHidden();
    expect(await getCredentialsForUser(user.id)).toHaveLength(0);
  });
});
