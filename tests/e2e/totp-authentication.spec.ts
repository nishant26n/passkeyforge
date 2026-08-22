import { countSessionsForUser, getUserByEmail } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { currentTotpCode, wrongTotpCode } from "./helpers/totp";
import {
  loginViaUi,
  logoutViaUi,
  readSessionCookie,
  uniqueEmail,
  type TestUser,
} from "./helpers/users";

/**
 * Enables TOTP for a user through the real settings UI and returns the shared
 * secret so the test can act as the authenticator app. The secret is never
 * logged or asserted on.
 */
async function enableTotp(page: import("@playwright/test").Page, user: TestUser) {
  await loginViaUi(page, user);
  await page.goto("/settings/passkeys");
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  await page.getByText("Can't scan? Enter the setup key").click();
  const secret = (await page.locator("details code").innerText()).trim();

  await page
    .getByRole("textbox", { name: "6-digit authentication code" })
    .fill(await currentTotpCode(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Authenticator app enabled" }),
  ).toBeVisible();

  await page.goto("/");
  await logoutViaUi(page);

  return secret;
}

test.describe("TOTP authentication", () => {
  test("authenticator sign-in page loads with its fields", async ({ page }) => {
    await page.goto("/authenticator-login");

    await expect(
      page.getByRole("heading", { name: "Login with authenticator code" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Authentication code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  test("client validation requires a six digit code", async ({ page }) => {
    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Authentication code").fill("123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter the 6-digit code.")).toBeVisible();
  });

  test("user can sign in with a valid authenticator code", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    const secret = await enableTotp(page, user);

    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(user.email);
    await page
      .getByLabel("Authentication code")
      .fill(await currentTotpCode(secret));
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    await expect(page).toHaveURL("/");

    const cookie = await readSessionCookie(page);
    expect(cookie).not.toBeNull();
    expect(cookie!.httpOnly).toBe(true);
    expect(await countSessionsForUser(user.id)).toBeGreaterThanOrEqual(1);
  });

  test("an invalid authenticator code is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    const secret = await enableTotp(page, user);

    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(user.email);
    await page
      .getByLabel("Authentication code")
      .fill(await wrongTotpCode(secret));
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid recovery code" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("a code from the previous secret stops working after setup restarts", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    const oldSecret = await enableTotp(page, user);

    // Starting setup again issues a new secret and turns TOTP off.
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");
    await page.getByRole("button", { name: "Replace authenticator app" }).click();
    await expect(
      page.getByRole("img", { name: "TOTP setup QR code" }),
    ).toBeVisible();
    await page.goto("/");
    await logoutViaUi(page);

    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(user.email);
    await page
      .getByLabel("Authentication code")
      .fill(await currentTotpCode(oldSecret));
    await page.getByRole("button", { name: "Sign in" }).click();

    // totpEnabled is false until a code from the new secret is confirmed.
    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid recovery credentials" }),
    ).toBeVisible();
    expect((await getUserByEmail(user.email))!.totpEnabled).toBe(false);
  });

  test("a user without TOTP enabled cannot sign in with a code", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Authentication code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid recovery credentials" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("an unknown email cannot sign in with a code", async ({ page }) => {
    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(uniqueEmail("no-such-user"));
    await page.getByLabel("Authentication code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid recovery credentials" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("the TOTP recovery API requires both an email and a code", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/recovery/totp", {
      data: { email: "" },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: "Email and code are required",
    });
  });

  test("another user's TOTP code cannot sign in as someone else", async ({
    page,
    createUser,
  }) => {
    const owner = await createUser({ prefix: "owner" });
    const other = await createUser({ prefix: "other" });
    const secret = await enableTotp(page, owner);

    await page.goto("/authenticator-login");
    await page.getByLabel("Email").fill(other.email);
    await page
      .getByLabel("Authentication code")
      .fill(await currentTotpCode(secret));
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid recovery credentials" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });
});
