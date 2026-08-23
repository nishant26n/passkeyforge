import { getUserByEmail } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import { currentTotpCode, wrongTotpCode } from "./helpers/totp";
import { loginViaUi } from "./helpers/users";
import { fetchFromPage } from "./helpers/webauthn";

/**
 * Reads the base32 setup key out of the "Can't scan?" disclosure. `<code>` has
 * no ARIA role of its own, so it is reached through the one `<details>` on the
 * page. The value is a shared secret: it is used to derive codes and is never
 * asserted on or logged.
 */
async function readSetupKey(page: import("@playwright/test").Page) {
  await page.getByText("Can't scan? Enter the setup key").click();
  return (await page.locator("details code").innerText()).trim();
}

test.describe("TOTP setup", () => {
  test("unauthenticated user cannot reach the security settings page", async ({
    page,
  }) => {
    await page.goto("/settings/passkeys");

    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("button", { name: "Set up authenticator app" }),
    ).toBeHidden();
  });

  test("unauthenticated TOTP setup and verify are rejected", async ({
    request,
  }) => {
    const setup = await request.post("/api/auth/totp/setup");
    const verify = await request.post("/api/auth/totp/verify", {
      data: { code: "123456" },
    });

    expect(setup.status()).toBe(401);
    expect(verify.status()).toBe(401);
  });

  test("authenticator section starts in the not-set-up state", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");

    await expect(
      page.getByRole("heading", { name: "Authenticator app" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Not set up yet. Add an authenticator app to generate sign-in codes.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set up authenticator app" }),
    ).toBeVisible();
  });

  test("starting setup shows the QR code and the setup key", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");

    await page.getByRole("button", { name: "Set up authenticator app" }).click();

    await expect(page.getByText("Scan the QR code")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "TOTP setup QR code" }),
    ).toBeVisible();
    await expect(page.getByText("Enter the 6-digit code")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "6-digit authentication code" }),
    ).toBeVisible();

    const setupKey = await readSetupKey(page);
    expect(setupKey).toMatch(/^[A-Z2-7]+$/);

    // The secret is stored server-side and TOTP is not enabled until confirmed.
    const dbUser = await getUserByEmail(user.email);
    expect(dbUser!.totpSecret).not.toBeNull();
    expect(dbUser!.totpEnabled).toBe(false);
  });

  test("setup returns an otpauth URI naming the issuer and the account", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(page, "/api/auth/totp/setup", {
      method: "POST",
    });

    expect(result.status).toBe(200);
    const uri = new URL(String(result.body!.uri));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.searchParams.get("issuer")).toBe("PasskeyForge");
    expect(decodeURIComponent(uri.pathname)).toContain(user.email);
    expect(uri.searchParams.get("secret")).toBeTruthy();
  });

  test("an invalid code is rejected and TOTP stays off", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");
    await page.getByRole("button", { name: "Set up authenticator app" }).click();

    const setupKey = await readSetupKey(page);
    await page
      .getByRole("textbox", { name: "6-digit authentication code" })
      .fill(await wrongTotpCode(setupKey));
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid authentication code" }),
    ).toBeVisible();
    expect((await getUserByEmail(user.email))!.totpEnabled).toBe(false);
  });

  test("user can configure TOTP with a valid code", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");
    await page.getByRole("button", { name: "Set up authenticator app" }).click();

    const setupKey = await readSetupKey(page);
    await page
      .getByRole("textbox", { name: "6-digit authentication code" })
      .fill(await currentTotpCode(setupKey));
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Authenticator app enabled" }),
    ).toBeVisible();
    // Exact match: the success alert also contains the word "enabled".
    await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Replace authenticator app" }),
    ).toBeVisible();

    expect((await getUserByEmail(user.email))!.totpEnabled).toBe(true);
  });

  test("restarting setup turns TOTP back off until a new code is confirmed", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await page.goto("/settings/passkeys");
    await page.getByRole("button", { name: "Set up authenticator app" }).click();
    const firstKey = await readSetupKey(page);
    await page
      .getByRole("textbox", { name: "6-digit authentication code" })
      .fill(await currentTotpCode(firstKey));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Authenticator app enabled" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Replace authenticator app" }).click();

    await expect(
      page.getByRole("img", { name: "TOTP setup QR code" }),
    ).toBeVisible();
    const secondKey = await readSetupKey(page);
    expect(secondKey).not.toBe(firstKey);

    const dbUser = await getUserByEmail(user.email);
    expect(dbUser!.totpEnabled).toBe(false);
  });

  test("verify rejects a code that is not six digits", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(page, "/api/auth/totp/verify", {
      method: "POST",
      body: { code: "12ab" },
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "Enter a valid 6-digit code" });
  });

  test("verify is refused before setup has been started", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);

    const result = await fetchFromPage(page, "/api/auth/totp/verify", {
      method: "POST",
      body: { code: "123456" },
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "TOTP setup has not been started" });
  });
});
