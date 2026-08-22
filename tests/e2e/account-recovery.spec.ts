import { getRecoveryCodeStats } from "./helpers/db";
import { expect, test } from "./helpers/fixtures";
import {
  loginViaUi,
  logoutViaUi,
  readSessionCookie,
  uniqueEmail,
} from "./helpers/users";
import { generateFirstSet } from "./helpers/recovery";
import { fetchFromPage } from "./helpers/webauthn";

test.describe("account recovery", () => {
  test("recovery page loads with its fields and links", async ({ page }) => {
    await page.goto("/recovery");

    await expect(page).toHaveTitle("Recover your account · Passkey Forge");
    await expect(
      page.getByRole("heading", { name: "Use a recovery code" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Recovery code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Use an authenticator code instead" }),
    ).toHaveAttribute("href", "/authenticator-login");
    await expect(
      page.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  test("recovery form validates the email and the code length", async ({
    page,
  }) => {
    await page.goto("/recovery");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Recovery code").fill("ABCD");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(
      page.getByText("Enter the full 12-character recovery code."),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("the code field normalises what the user types", async ({ page }) => {
    await page.goto("/recovery");
    await page.getByLabel("Recovery code").fill("abcd1234efab");

    // Stored codes are uppercase and dashed; the field rebuilds that shape.
    await expect(page.getByLabel("Recovery code")).toHaveValue(
      "ABCD-1234-EFAB",
    );
  });

  test("an unknown account is rejected", async ({ page }) => {
    await page.goto("/recovery");
    await page.getByLabel("Email").fill(uniqueEmail("no-such-user"));
    await page.getByLabel("Recovery code").fill("AAAA-BBBB-CCCC");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid recovery credentials" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("an invalid recovery code for a real account is rejected", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    await generateFirstSet(page);
    await page.goto("/");
    await logoutViaUi(page);

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill("0000-0000-0000");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid or already used recovery code" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
    expect(await getRecoveryCodeStats(user.id)).toEqual({ total: 10, used: 0 });
  });

  test("recovery cannot succeed for an account with no codes", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill("AAAA-BBBB-CCCC");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid or already used recovery code" }),
    ).toBeVisible();
    expect(await readSessionCookie(page)).toBeNull();
  });

  test("recovery API requires both an email and a code", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/recovery/code", {
      data: { email: "" },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: "Email and code are required",
    });
  });

  test("successful recovery establishes a full session", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const codes = await generateFirstSet(page);
    await page.goto("/");
    await logoutViaUi(page);

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();

    // The recovered session is a normal one: it reaches protected routes and
    // authenticated APIs.
    await page.goto("/settings/passkeys");
    await expect(page.getByText(`Signed in as ${user.email}`)).toBeVisible();

    const me = await fetchFromPage(page, "/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: { id: user.id, email: user.email } });
  });

  test("user can still log in normally after recovering", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();
    await loginViaUi(page, user);
    const codes = await generateFirstSet(page);
    await page.goto("/");
    await logoutViaUi(page);

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill(codes[0]);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "You're signed in" }),
    ).toBeVisible();
    await logoutViaUi(page);

    await loginViaUi(page, user);
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test("recovery does not let a signed-out visitor reach the settings page", async ({
    page,
    createUser,
  }) => {
    const user = await createUser();

    await page.goto("/recovery");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Recovery code").fill("AAAA-BBBB-CCCC");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.goto("/settings/passkeys");
    await expect(page).toHaveURL("/login");
  });
});
