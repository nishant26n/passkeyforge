import { expect, test } from "./helpers/fixtures";
import { runOAuthLoginToToken, setUpOAuthTestClient } from "./helpers/oauth";
import { loginViaUi } from "./helpers/users";

test.describe("OAuth test client UI", () => {
  test("starting OAuth login redirects to the callback with an authorization code", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await setUpOAuthTestClient(page);

    await page.getByRole("button", { name: "Start OAuth Login" }).click();

    await expect(page).toHaveURL(/\/oauth\/test\/callback\?code=.+&state=.+/);
    await expect(page.getByText("Access token obtained.")).toBeVisible();
  });

  test("a state mismatch at the callback is rejected without exchanging the code", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await setUpOAuthTestClient(page);

    // A real authorization code is never issued here — a state mismatch must
    // be caught before the callback ever calls the token endpoint.
    await page.goto("/oauth/test/callback?code=untrusted-code&state=wrong-state");

    await expect(
      page.getByText("State mismatch — possible CSRF. Flow aborted."),
    ).toBeVisible();
  });

  test("a callback without an authorization code shows an error", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await setUpOAuthTestClient(page);

    await page.goto("/oauth/test/callback");

    await expect(
      page.getByText("Callback did not include an authorization code."),
    ).toBeVisible();
  });

  test("the full token exchange, userinfo, and revocation flow succeeds end-to-end", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await runOAuthLoginToToken(page);

    await page.getByRole("button", { name: "Get User Info" }).click();
    await expect(page.getByText(`"email": "${user.email}"`)).toBeVisible();

    await page.getByRole("button", { name: "Revoke Access Token" }).click();
    await expect(page.getByText("Token revoked")).toBeVisible();

    await page.getByRole("button", { name: "Test Revoked Token" }).click();
    await expect(
      page.getByText(
        "Revocation verified — the revoked token was rejected with 401 invalid_token.",
      ),
    ).toBeVisible();
  });

  test("the registered client's secret is never rendered in the browser", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/oauth/test");

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/oauth/clients") &&
          res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Register new test client" }).click(),
    ]);

    const body = await response.json();
    const secret = body.clientSecret as string;
    expect(secret).toBeTruthy();

    await expect(page.locator("body")).not.toContainText(secret);
  });
});
