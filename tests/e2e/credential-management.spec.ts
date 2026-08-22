import { getCredentialsForUser } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import {
  loginViaUi,
  logoutViaUi,
  uniqueClientIp,
} from "./helpers/users";
import {
  addVirtualAuthenticator,
  fetchFromPage,
  registerPasskeyViaUi,
} from "./helpers/webauthn";

test.describe("passkey credential management", () => {
  test("unauthenticated user cannot list credentials", async ({ request }) => {
    const response = await request.get("/api/webauthn/credentials");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("authenticated user can list their credentials", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "Desk key");

    const result = await fetchFromPage(page, "/api/webauthn/credentials");
    const credentials = result.body!.credentials as Array<{
      id: string;
      name: string | null;
      credentialID: string;
    }>;

    expect(result.status).toBe(200);
    expect(credentials).toHaveLength(1);
    expect(credentials[0].name).toBe("Desk key");

    const stored = await getCredentialsForUser(user.id);
    expect(credentials[0].id).toBe(stored[0].id);
  });

  test("credential name is displayed in the passkey list", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "Phone");

    await expect(page.getByText("Phone")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove Phone" }),
    ).toBeVisible();
    await expect(page.getByText(/Added /)).toBeVisible();
  });

  test("a passkey saved without a name falls back to its transport label", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page);

    // The virtual authenticator reports the "internal" transport.
    await expect(page.getByText("internal", { exact: true })).toBeVisible();
    expect((await getCredentialsForUser(user.id))[0].name).toBeNull();
  });

  test("user can revoke a passkey and it disappears from the list", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "Old key");

    await page.getByRole("button", { name: "Remove Old key" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Passkey removed" }),
    ).toBeVisible();
    await expect(page.getByText("0 registered")).toBeVisible();
    await expect(page.getByText("Old key")).toBeHidden();
    expect(await getCredentialsForUser(user.id)).toHaveLength(0);
  });

  test("revoking can be cancelled", async ({ page, createUser }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "Keep me");

    await page.getByRole("button", { name: "Remove Keep me" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(
      page.getByRole("button", { name: "Remove Keep me" }),
    ).toBeVisible();
    expect(await getCredentialsForUser(user.id)).toHaveLength(1);
  });

  test("a revoked passkey can no longer authenticate", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "Doomed key");

    await page.getByRole("button", { name: "Remove Doomed key" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("0 registered")).toBeVisible();

    await logoutViaUi(page);

    await page.goto("/login/passkey");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Login with Passkey" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "No passkey is registered for this account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeHidden();
  });

  test("revoking an unknown credential id returns 404", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(
      page,
      "/api/webauthn/credentials/cl000000000000000000000",
      { method: "DELETE" },
    );

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: "Credential not found" });
  });

  test("user cannot revoke another user's credential", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const victim = await createUser({ prefix: "victim" });
    const attacker = await createUser({ prefix: "attacker" });

    // The victim registers a passkey in their own browser context.
    const victimContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const victimPage = await victimContext.newPage();
    await loginViaUi(victimPage, victim);
    await addVirtualAuthenticator(victimPage);
    await registerPasskeyViaUi(victimPage, "Victim key");
    const victimCredentials = await getCredentialsForUser(victim.id);
    expect(victimCredentials).toHaveLength(1);

    // The attacker knows the credential's id and tries to delete it.
    await loginViaUi(page, attacker);
    const result = await fetchFromPage(
      page,
      `/api/webauthn/credentials/${victimCredentials[0].id}`,
      { method: "DELETE" },
    );

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: "Credential not found" });
    expect(await getCredentialsForUser(victim.id)).toHaveLength(1);

    // And the attacker's own listing never shows it.
    const listing = await fetchFromPage(page, "/api/webauthn/credentials");
    expect(listing.body!.credentials).toEqual([]);

    await victimContext.close();
  });

  test("credential listing is scoped to the signed-in user", async ({
    page,
    browser,
    baseURL,
    createUser,
  }) => {
    const first = await createUser({ prefix: "first" });
    const second = await createUser({ prefix: "second" });

    await loginViaUi(page, first);
    await addVirtualAuthenticator(page);
    await registerPasskeyViaUi(page, "First key");

    const otherContext = await browser.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
    });
    const otherPage = await otherContext.newPage();
    await loginViaUi(otherPage, second);
    await addVirtualAuthenticator(otherPage);
    await registerPasskeyViaUi(otherPage, "Second key");

    const firstListing = await fetchFromPage(page, "/api/webauthn/credentials");
    const secondListing = await fetchFromPage(
      otherPage,
      "/api/webauthn/credentials",
    );

    const names = (result: typeof firstListing) =>
      (result.body!.credentials as Array<{ name: string | null }>).map(
        (credential) => credential.name,
      );

    expect(names(firstListing)).toEqual(["First key"]);
    expect(names(secondListing)).toEqual(["Second key"]);

    await otherContext.close();
  });
});
